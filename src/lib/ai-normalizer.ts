import pb from '@/lib/pocketbase/client'
import { ExtractedOrder } from './extractor-types'

export interface AiNormalizeResponse {
  ok: boolean
  orders: Array<{
    orderNumber?: string
    customerName?: string
    header?: {
      cnpj?: string
      obs?: string
      nature?: string
    }
    items?: Array<{
      itemCode?: string
      barcode?: string
      reference?: string
      description?: string
      qty?: string | number
    }>
  }>
  rawContent?: string
  warning?: string
  error?: string
}

/**
 * Normalizes raw order text through Skip Cloud's native AI Agent.
 * Gracefully handles parsing failures and returns mapped ExtractedOrder list.
 */
export async function normalizeTextWithAi(
  rawText: string,
  isOcr = false,
): Promise<ExtractedOrder[]> {
  const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
  const endpoint = `${backendUrl.replace(/\/+$/, '')}/api/zalike/normalize-order`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (pb.authStore.token) {
    headers['Authorization'] = pb.authStore.token
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: rawText }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || `Falha na requisição da IA (${response.status})`)
  }

  const data = (await response.json()) as AiNormalizeResponse

  if (!data.ok || !data.orders || data.orders.length === 0) {
    // Return empty array indicating fallback is needed
    return []
  }

  return data.orders.map((o, idx) => {
    const rawCnpj = o.header?.cnpj || ''
    // Normalize CNPJ: keep digits or standard format
    const cleanCnpj = rawCnpj.trim()

    const mappedItems = (o.items || []).map((it) => ({
      id: crypto.randomUUID(),
      itemCode: (it.itemCode || '').trim(),
      barcode: (it.barcode || '').replace(/\D/g, '').trim(),
      reference: (it.reference || '').trim(),
      qty: String(it.qty || '1').trim(),
    }))

    return {
      id: crypto.randomUUID(),
      orderNumber: o.orderNumber || `Pedido #${idx + 1}`,
      customerName: o.customerName || undefined,
      confidence: isOcr ? 'low' : 'high',
      isOcr,
      rawText: rawText,
      warning: isOcr ? 'Texto obtido via OCR: verifique os códigos e quantidades.' : undefined,
      header: {
        cnpj: cleanCnpj,
        repCode: '',
        paymentCode: '',
        paymentDesc: '',
        obs: (o.header?.obs || '').trim(),
        nature: (o.header?.nature || 'Venda').trim() || 'Venda',
      },
      items: mappedItems,
    }
  })
}
