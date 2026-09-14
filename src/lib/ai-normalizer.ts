import pb from '@/lib/pocketbase/client'
import { ExtractedOrder } from './extractor-types'
import { formatCnpj } from './utils'

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
  const endpoint = `${backendUrl.replace(/\/+$/, '')}/backend/v1/zalike/normalize-order`

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
    let errorMsg = `Falha na requisição da IA (${response.status})`
    try {
      const errorBody = await response.json()
      if (errorBody && errorBody.error) {
        errorMsg = errorBody.error
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg)
  }

  let data: AiNormalizeResponse
  try {
    data = (await response.json()) as AiNormalizeResponse
  } catch (parseErr) {
    console.warn('[ai-normalizer] Resposta da API não é JSON válido:', parseErr)
    return []
  }

  if (!data.ok || !data.orders || data.orders.length === 0) {
    // Return empty array indicating fallback is needed
    return []
  }

  return data.orders.map((o, idx) => {
    const rawCnpj = o.header?.cnpj || ''
    // Normalize CNPJ to standard XX.XXX.XXX/XXXX-XX format
    const formattedCnpj = formatCnpj(rawCnpj)

    const mappedItems = (o.items || []).map((it) => {
      const reference = (it.reference || '').trim()
      // IMPORTANTE: itemCode nunca deve vir da extração/IA — é sempre o
      // código do CLIENTE no documento original, nunca o código interno
      // Zalike (esse só é resolvido pelo Fluxo 2 no ERP, ou digitado à mão
      // na revisão). Mesmo com o prompt do agente já instruído a deixar
      // itemCode vazio, esta é uma rede de segurança: se a IA devolver algo
      // ali mesmo assim, ele vira valor de busca em `reference` (aceito
      // pelo Fluxo 2 junto com o EAN) em vez de contaminar o campo final.
      const aiItemCode = (it.itemCode || '').trim()
      return {
        id: crypto.randomUUID(),
        itemCode: '',
        barcode: (it.barcode || '').replace(/\D/g, '').trim(),
        reference: reference || aiItemCode,
        qty: String(it.qty || '1').trim(),
      }
    })

    return {
      id: crypto.randomUUID(),
      orderNumber: o.orderNumber || `Pedido #${idx + 1}`,
      customerName: o.customerName || undefined,
      confidence: isOcr ? 'low' : 'high',
      isOcr,
      rawText: rawText,
      warning: isOcr ? 'Texto obtido via OCR: verifique os códigos e quantidades.' : undefined,
      header: {
        cnpj: formattedCnpj,
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
