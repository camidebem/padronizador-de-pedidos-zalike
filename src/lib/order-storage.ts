import { ExtractedOrder, ExtractionResult } from './extractor-types'

const ACTIVE_EXTRACTION_KEY = 'zalike_active_extraction'
const PROCESSED_ORDERS_KEY = 'zalike_processed_orders'

/**
 * Sanitizes an order object to ensure all strings and numbers can be cleanly serialized to JSON,
 * stripping out undefined, NaN, Infinity and truncating rawText if necessary to preserve quota.
 */
export function sanitizeOrderForStorage(
  order: ExtractedOrder,
  maxRawTextLength = 2000,
): ExtractedOrder {
  return {
    id: String(order.id || ''),
    orderNumber: String(order.orderNumber || ''),
    customerName: order.customerName ? String(order.customerName) : undefined,
    confidence: order.confidence || 'manual',
    isOcr: Boolean(order.isOcr),
    // Truncate rawText per order to avoid filling sessionStorage when multiple orders exist
    rawText: order.rawText ? String(order.rawText).slice(0, maxRawTextLength) : undefined,
    warning: order.warning ? String(order.warning) : undefined,
    header: {
      cnpj: String(order.header?.cnpj || ''),
      repCode: String(order.header?.repCode || ''),
      paymentCode: String(order.header?.paymentCode || ''),
      paymentDesc: String(order.header?.paymentDesc || ''),
      obs: String(order.header?.obs || ''),
      nature: String(order.header?.nature || 'Venda'),
      idCliente: order.header?.idCliente ? String(order.header.idCliente) : null,
    },
    items: Array.isArray(order.items)
      ? order.items.map((it) => ({
          id: String(it.id || ''),
          itemCode: String(it.itemCode || ''),
          barcode: String(it.barcode || ''),
          reference: String(it.reference || ''),
          qty: String(it.qty ?? '1'),
        }))
      : [],
  }
}

/**
 * Sanitizes the complete extraction result before serializing.
 * If the payload is too large, it automatically truncates or strips raw texts.
 */
export function sanitizeExtractionResult(result: ExtractionResult): ExtractionResult {
  const sanitizedOrders = (result.orders || []).map((ord) => sanitizeOrderForStorage(ord, 1500))
  return {
    fileName: String(result.fileName || 'arquivo'),
    fileType: result.fileType === 'excel' ? 'excel' : 'pdf',
    orders: sanitizedOrders,
    totalOrders:
      typeof result.totalOrders === 'number' && !Number.isNaN(result.totalOrders)
        ? result.totalOrders
        : sanitizedOrders.length,
    isOcr: Boolean(result.isOcr),
    rawTextPreview: result.rawTextPreview ? String(result.rawTextPreview).slice(0, 300) : undefined,
    warning: result.warning ? String(result.warning) : undefined,
  }
}

/**
 * Safely parses a JSON string, returning a fallback value if invalid or empty.
 */
export function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr || typeof jsonStr !== 'string') return fallback
  const trimmed = jsonStr.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return fallback
  try {
    return JSON.parse(trimmed) as T
  } catch (err) {
    console.warn('[storage] Erro ao fazer JSON.parse, usando fallback seguro:', err)
    return fallback
  }
}

/**
 * Safely stringifies data with fallback.
 */
export function safeJsonStringify<T>(data: T, fallback = ''): string {
  try {
    return JSON.stringify(data)
  } catch (err) {
    console.warn('[storage] Erro ao serializar JSON:', err)
    return fallback
  }
}

/**
 * Stores extraction result in sessionStorage with quota protection.
 * If QuotaExceededError occurs, it progressively removes rawText to fit in storage.
 */
export function saveActiveExtraction(result: ExtractionResult): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false

  // Attempt 1: Full sanitized result
  try {
    const sanitized = sanitizeExtractionResult(result)
    const jsonStr = safeJsonStringify(sanitized)
    if (jsonStr) {
      window.sessionStorage.setItem(ACTIVE_EXTRACTION_KEY, jsonStr)
      return true
    }
  } catch (err) {
    console.warn(
      '[storage] Falha ao salvar active_extraction com rawText, tentando versão compacta...',
      err,
    )
  }

  // Attempt 2: Strip rawText from all orders to save 90%+ space
  try {
    const compactResult: ExtractionResult = {
      ...result,
      rawTextPreview: undefined,
      orders: (result.orders || []).map((ord) => ({
        ...sanitizeOrderForStorage(ord, 0),
        rawText: undefined,
      })),
    }
    const compactJson = safeJsonStringify(compactResult)
    if (compactJson) {
      window.sessionStorage.setItem(ACTIVE_EXTRACTION_KEY, compactJson)
      return true
    }
  } catch (err2) {
    console.warn('[storage] Cota de sessionStorage excedida mesmo na versão compacta:', err2)
  }

  return false
}

/**
 * Loads active extraction from sessionStorage safely.
 */
export function loadActiveExtraction(): ExtractionResult | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_EXTRACTION_KEY)
    const parsed = safeJsonParse<ExtractionResult | null>(raw, null)
    if (parsed && Array.isArray(parsed.orders)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Loads processed order IDs list from sessionStorage.
 */
export function loadProcessedOrderIds(): string[] {
  if (typeof window === 'undefined' || !window.sessionStorage) return []
  try {
    const raw = window.sessionStorage.getItem(PROCESSED_ORDERS_KEY)
    const parsed = safeJsonParse<string[]>(raw, [])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Adds an order ID to the processed orders list in sessionStorage.
 */
export function markOrderAsProcessed(orderId: string): void {
  if (!orderId || typeof window === 'undefined' || !window.sessionStorage) return
  try {
    const current = loadProcessedOrderIds()
    if (!current.includes(orderId)) {
      const next = [...current, orderId]
      const json = safeJsonStringify(next, '[]')
      window.sessionStorage.setItem(PROCESSED_ORDERS_KEY, json)
    }
  } catch (err) {
    console.warn('[storage] Erro ao marcar pedido como processado:', err)
  }
}

/**
 * Resets processed order IDs.
 */
export function resetProcessedOrders(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.setItem(PROCESSED_ORDERS_KEY, '[]')
  } catch {
    /* ignore */
  }
}

/**
 * Clears all active extraction session data.
 */
export function clearActiveExtraction(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.removeItem(ACTIVE_EXTRACTION_KEY)
    window.sessionStorage.removeItem(PROCESSED_ORDERS_KEY)
  } catch {
    /* ignore */
  }
}
