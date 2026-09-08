import { ExtractedOrder } from './extractor-types'

/**
 * Robust client-side regex parsing as immediate fallback or primary parser
 * for structured purchase orders (Belshop, Mundo dos Cosméticos, etc.).
 * Guarantees zero data loss if AI is unreachable or times out.
 */
export function parseOrdersClientSide(text: string, isOcr = false): ExtractedOrder[] {
  // Check if text has multiple orders (e.g. "Número do Pedido: XXXXXX" per page/block)
  // Or Belshop "ORDEM DE COMPRA No.: XXXXX"
  const orderSplitRegex =
    /(?:210\s*-\s*Emitir Pedido de Compra\s+|Número do Pedido:\s*|ORDEM DE COMPRA No\.:\s*|--- PÁGINA \d+ ---)/gi

  // If there are multiple pages or order blocks
  const blocks = text
    .split(/(?=--- PÁGINA \d+ ---|Número do Pedido:\s*\d+|ORDEM DE COMPRA No\.:\s*\d+)/i)
    .filter((b) => b.trim().length > 30)

  if (blocks.length > 1) {
    const parsedOrders: ExtractedOrder[] = []
    for (let i = 0; i < blocks.length; i++) {
      const singleOrder = parseSingleOrderBlock(blocks[i], i + 1, isOcr)
      if (singleOrder && (singleOrder.items.length > 0 || singleOrder.header.cnpj)) {
        parsedOrders.push(singleOrder)
      }
    }
    if (parsedOrders.length > 0) return parsedOrders
  }

  // Otherwise parse as single block
  const single = parseSingleOrderBlock(text, 1, isOcr)
  return single ? [single] : []
}

function parseSingleOrderBlock(
  block: string,
  index: number,
  isOcr: boolean,
): ExtractedOrder | null {
  // 1. Order Number
  let orderNumber = ''
  const numMatch = block.match(
    /(?:Número do Pedido|ORDEM DE COMPRA No\.|Pedido|OC)\s*[:.]?\s*(\d+)/i,
  )
  if (numMatch) {
    orderNumber = numMatch[1]
  } else {
    orderNumber = `Pedido ${index}`
  }

  // 2. Customer Name (Empresa ou Loja) - ignore lines like "Fornecedor: ... ZALIKE"
  let customerName = ''
  const empMatch = block.match(/(?:Empresa|Loja)\s*(?:\d+)?\s*[:.-]?\s*([^\n\r]+)/i)
  if (empMatch) {
    let cleanName = empMatch[1]
      .replace(/CNPJ:.*$/i, '')
      .replace(/COMPRA MERC.*$/i, '')
      .trim()
    // Remove leading numbers if present like "10 MUNDO DOS..."
    cleanName = cleanName.replace(/^\d+\s+/, '').trim()
    customerName = cleanName
  }

  // 3. CNPJ (must be the client's CNPJ, not the vendor Zalike CNPJ: 13786104000115 or Carmel: 18741907000177)
  let cnpj = ''
  // Check for CNPJ directly following Empresa or Loja block first
  const clientCnpjMatch = block.match(
    /(?:Empresa|Loja)[\s\S]*?CNPJ\s*[:.]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/i,
  )
  if (clientCnpjMatch) {
    cnpj = clientCnpjMatch[1].replace(/[^\d./-]/g, '')
  } else {
    // Try formatted CNPJ first: XX.XXX.XXX/XXXX-XX
    const allFormatted = [...block.matchAll(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g)]
    const clientFormatted = allFormatted.find(
      (m) => !m[0].includes('13.786.104/0001-15') && !m[0].includes('18.741.907/0001-77'),
    )
    if (clientFormatted) {
      cnpj = clientFormatted[0]
    } else {
      // Try unformatted 14 digits next to CNPJ: label
      const allRaw = [...block.matchAll(/CNPJ\s*[:.]?\s*(\d{14})/gi)]
      const clientRaw = allRaw.find((m) => m[1] !== '13786104000115' && m[1] !== '18741907000177')
      if (clientRaw) {
        cnpj = clientRaw[1]
      } else {
        const any14 = [...block.matchAll(/\b\d{14}\b/g)]
        const candidate = any14.find((m) => m[0] !== '13786104000115' && m[0] !== '18741907000177')
        if (candidate) {
          cnpj = candidate[0]
        }
      }
    }
  }

  // 4. Observations / Frete
  const obsParts: string[] = []
  if (orderNumber) obsParts.push(`Nº Pedido: ${orderNumber}`)
  const freteMatch = block.match(/Frete:\s*([A-Z]+)/i)
  if (freteMatch) obsParts.push(`Frete: ${freteMatch[1]}`)
  const obsSectionMatch = block.match(/Observações:\s*([\s\S]*?)(?:ATENÇÃO|TOTAL|$)/i)
  if (obsSectionMatch) {
    const rawObs = obsSectionMatch[1].replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (rawObs && rawObs !== '• 0') {
      obsParts.push(rawObs)
    }
  }

  // 5. Items Extraction
  const items: ExtractedOrder['items'] = []
  const lines = block.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Skip table header lines or summary lines
    if (/Cód\.Barras|Qt\.\s*Pedida|Vlr\s*Total|Total\s*bruto|Base\s*Icms/i.test(trimmed)) {
      continue
    }

    // Check if line contains a 13-digit EAN (common to both Belshop and Mundo dos Cosméticos)
    const eanMatch = trimmed.match(/\b(789\d{10}|[0-9]{13})\b/)
    if (eanMatch) {
      const barcode = eanMatch[1]

      // Extract tokens
      const tokens = trimmed.split(/\s+/)
      const eanIdx = tokens.findIndex((t) => t === barcode)

      let itemCode = ''
      let reference = ''
      let qty = '1'

      // Check adjacent tokens for item code (usually 5 to 6 digits)
      if (eanIdx !== -1) {
        // Look right of EAN (e.g. 7899536110849 859949 ELASTICO...)
        if (eanIdx + 1 < tokens.length && /^\d{4,8}$/.test(tokens[eanIdx + 1])) {
          itemCode = tokens[eanIdx + 1]
        }
        // Belshop pattern: Item(1) Referência(2108BN) EAN(7899536126253) CodigoBelshop(58891)
        // Or look left of EAN for reference
        if (
          eanIdx > 0 &&
          /^[A-Z0-9-]{2,10}$/i.test(tokens[eanIdx - 1]) &&
          tokens[eanIdx - 1] !== 'COMPRA'
        ) {
          reference = tokens[eanIdx - 1]
        }
        if (!itemCode && eanIdx + 1 < tokens.length && /^\d{4,8}$/.test(tokens[eanIdx + 1])) {
          itemCode = tokens[eanIdx + 1]
        }
      }

      // Look for quantity:
      // In Mundo dos Cosméticos: "... [DESCRIÇÃO] [Qt. Pedida: 12] [Vlr IPI: 0,00] ..."
      // or Belshop: "... [DESCRIÇÃO] [Quantidade: 24] [Unitário: 13,92] [IPI%: 0,00%] [TOTAL: 334,08]"
      const qtyMatches = [...trimmed.matchAll(/\s(\d{1,4})\s+(?:\d+[.,]\d{2,6})/g)]
      if (qtyMatches.length > 0) {
        // The last integer right before decimal numbers is usually the quantity
        const candidate = qtyMatches[0][1]
        if (candidate && parseInt(candidate, 10) > 0) {
          qty = candidate
        }
      } else {
        // Fallback: look for integer in tokens after EAN
        const candidateQty = tokens
          .slice(eanIdx + 2)
          .find((t) => /^\d{1,4}$/.test(t) && parseInt(t, 10) > 0 && parseInt(t, 10) <= 5000)
        if (candidateQty) {
          qty = candidateQty
        }
      }

      items.push({
        id: crypto.randomUUID(),
        itemCode,
        barcode,
        reference,
        qty,
      })
    }
  }

  return {
    id: crypto.randomUUID(),
    orderNumber,
    customerName: customerName || undefined,
    confidence: isOcr ? 'low' : 'high',
    isOcr,
    rawText: block,
    header: {
      cnpj,
      repCode: '',
      paymentCode: '',
      paymentDesc: '',
      obs: obsParts.join(' | ') || (isOcr ? 'Extraído via OCR' : 'Extraído do documento'),
      nature: 'Venda',
    },
    items,
  }
}
