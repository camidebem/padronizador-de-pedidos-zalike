import * as XLSX from 'xlsx'
import { ExtractedOrder } from './extractor-types'

/**
 * Extracts order items from an Excel workbook (.xlsx / .xls).
 * Handles header rows, stores context, and ignores invalid lines.
 * Never hardcodes specific items or customer names.
 */
export async function extractFromExcel(file: File): Promise<ExtractedOrder> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('A planilha está vazia.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows: Array<Array<string | number | undefined | null>> = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (rows.length === 0) {
    throw new Error('Nenhum dado encontrado na planilha.')
  }

  // Find the header row
  let headerIndex = -1
  let colEan = -1
  let colQty = -1
  let colRef = -1
  let colDesc = -1
  let colStore = -1
  let colItemCode = -1

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue

    const rowStrings = row.map((cell) => String(cell || '').trim().toLowerCase())

    const eanIdx = rowStrings.findIndex((c) => c === 'ean' || c.includes('barras') || c.includes('cod.barras') || c.includes('cód.barras'))
    const qtyIdx = rowStrings.findIndex((c) => c === 'qtd' || c === 'quantidade' || c.includes('qtde') || c.includes('quant'))

    if (eanIdx !== -1 && qtyIdx !== -1) {
      headerIndex = i
      colEan = eanIdx
      colQty = qtyIdx

      // Search other columns
      colRef = rowStrings.findIndex((c, idx) => idx !== eanIdx && idx !== qtyIdx && (c === 'referência' || c === 'referencia' || c.includes('ref') || c === 'column_3'))
      colDesc = rowStrings.findIndex((c, idx) => idx !== eanIdx && idx !== qtyIdx && (c.includes('descri') || c === 'produto'))
      colStore = rowStrings.findIndex((c, idx) => idx !== eanIdx && idx !== qtyIdx && (c.includes('loja') || c.includes('cliente')))
      colItemCode = rowStrings.findIndex((c, idx) => idx !== eanIdx && idx !== qtyIdx && (c.includes('código') || c.includes('codigo') || c.includes('cod')))
      break
    }
  }

  // If header row wasn't found by exact names, infer by scanning data
  let startRow = 1
  if (headerIndex !== -1) {
    startRow = headerIndex + 1
  } else {
    // Try to find first row where a cell has 13-digit EAN or valid quantity
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i]
      const hasEanLike = row.some((c) => {
        const s = String(c || '').trim()
        return /^\d{8,14}$/.test(s)
      })
      if (hasEanLike) {
        startRow = i
        // Guess column indexes from row cells
        row.forEach((c, idx) => {
          const s = String(c || '').trim()
          if (/^\d{12,14}$/.test(s) && colEan === -1) colEan = idx
          else if (/^\d{1,4}$/.test(s) && colQty === -1 && idx !== colEan) colQty = idx
        })
        break
      }
    }
  }

  const items: ExtractedOrder['items'] = []
  let storeContext = ''

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row) || row.length === 0) continue

    const eanRaw = colEan !== -1 ? String(row[colEan] || '').trim() : ''
    const qtyRaw = colQty !== -1 ? String(row[colQty] || '').trim() : ''
    const refRaw = colRef !== -1 ? String(row[colRef] || '').trim() : ''
    const descRaw = colDesc !== -1 ? String(row[colDesc] || '').trim() : ''
    const itemCodeRaw = colItemCode !== -1 && colItemCode !== colEan ? String(row[colItemCode] || '').trim() : ''

    if (colStore !== -1 && String(row[colStore] || '').trim() && !storeContext) {
      storeContext = String(row[colStore] || '').trim()
    }

    // Clean barcode: only digits
    const barcode = eanRaw.replace(/\D/g, '')
    // Clean qty
    const parsedQty = parseFloat(qtyRaw.replace(',', '.'))

    // Must have at least a barcode or reference, and a positive quantity to be a valid item
    if ((barcode.length >= 7 || refRaw.length > 0) && !isNaN(parsedQty) && parsedQty > 0) {
      items.push({
        id: crypto.randomUUID(),
        itemCode: itemCodeRaw,
        barcode: barcode,
        reference: refRaw,
        qty: String(Math.round(parsedQty)),
      })
    }
  }

  return {
    id: crypto.randomUUID(),
    orderNumber: file.name.replace(/\.[^/.]+$/, ''),
    customerName: storeContext || undefined,
    confidence: items.length > 0 ? 'high' : 'low',
    header: {
      cnpj: '',
      repCode: '',
      paymentCode: '',
      paymentDesc: '',
      obs: storeContext ? `Origem: ${storeContext}` : `Planilha: ${file.name}`,
      nature: 'Venda',
    },
    items,
  }
}
