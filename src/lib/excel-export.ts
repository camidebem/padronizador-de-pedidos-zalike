import * as XLSX from 'xlsx'
import { OrderHeader, OrderItem } from '@/hooks/use-order'

/**
 * Columns configuration for the standardized Zalike order export.
 * Total of 11 columns in exact required order.
 */
export const EXCEL_COLUMNS = [
  'CNPJ Do Cliente',
  'Cód. Representante',
  'Cód. F. Pagto',
  'Descrição da F. Pagto',
  'Obs. Do Pedido',
  'Natureza da Operação',
  'CNPJ da Transportadora',
  'Código do Item',
  'Código de Barras do Item',
  'Referência do Item',
  'Qtde. Do Item',
] as const

/**
 * Generates and triggers the download of the required standardized .xlsx Excel workbook.
 *
 * Rules:
 * - 11 columns in exact order
 * - One row per item, header fields repeated per row
 * - First row is the header
 * - CNPJ, Barcode (EAN) and Item Code are formatted explicitly as text (t: 's')
 *   to prevent leading zero stripping or scientific notation in Excel.
 * - Quantity is formatted as a number (t: 'n')
 * - Sheet name: "Pedidos"
 * - Output format: .xlsx
 */
export function generateExcel(header: OrderHeader, items: OrderItem[]): void {
  const wb = XLSX.utils.book_new()

  // Build the 2D array of data
  // Row 0: Header
  const rows: Array<Array<string | number>> = [[...EXCEL_COLUMNS]]

  for (const item of items) {
    const rawQty = parseFloat(String(item.qty || '0').replace(',', '.'))
    const numericQty = isNaN(rawQty) ? 0 : rawQty

    rows.push([
      header.cnpj || '',
      header.repCode || '',
      header.paymentCode || '',
      header.paymentDesc || '',
      header.obs || '',
      header.nature || '',
      '', // CNPJ da Transportadora (always empty)
      item.itemCode || '',
      item.barcode || '',
      item.reference || '',
      numericQty,
    ])
  }

  // Create worksheet with explicit types
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Explicitly enforce cell types and width metadata:
  // Column 0: CNPJ -> text ('s')
  // Column 7: Código do Item -> text ('s')
  // Column 8: Código de Barras do Item -> text ('s')
  // Column 9: Referência do Item -> text ('s')
  // Column 10: Qtde. Do Item -> number ('n')
  for (let r = 1; r < rows.length; r++) {
    // CNPJ (col 0 / A)
    const cnpjAddr = XLSX.utils.encode_cell({ r, c: 0 })
    if (ws[cnpjAddr]) {
      ws[cnpjAddr].t = 's'
      ws[cnpjAddr].v = String(ws[cnpjAddr].v ?? '')
    }

    // Código do Item (col 7 / H)
    const itemCodeAddr = XLSX.utils.encode_cell({ r, c: 7 })
    if (ws[itemCodeAddr]) {
      ws[itemCodeAddr].t = 's'
      ws[itemCodeAddr].v = String(ws[itemCodeAddr].v ?? '')
    }

    // Código de Barras (col 8 / I)
    const barcodeAddr = XLSX.utils.encode_cell({ r, c: 8 })
    if (ws[barcodeAddr]) {
      ws[barcodeAddr].t = 's'
      ws[barcodeAddr].v = String(ws[barcodeAddr].v ?? '')
      // Some versions of Excel display text cell strings with a leading apostrophe format
      ws[barcodeAddr].z = '@'
    }

    // Referência (col 9 / J)
    const refAddr = XLSX.utils.encode_cell({ r, c: 9 })
    if (ws[refAddr]) {
      ws[refAddr].t = 's'
      ws[refAddr].v = String(ws[refAddr].v ?? '')
    }

    // Qtde (col 10 / K)
    const qtyAddr = XLSX.utils.encode_cell({ r, c: 10 })
    if (ws[qtyAddr]) {
      ws[qtyAddr].t = 'n'
      ws[qtyAddr].v = Number(ws[qtyAddr].v || 0)
    }
  }

  // Column width suggestions for clean viewing in Excel
  ws['!cols'] = [
    { wch: 20 }, // CNPJ Do Cliente
    { wch: 18 }, // Cód. Representante
    { wch: 14 }, // Cód. F. Pagto
    { wch: 24 }, // Descrição da F. Pagto
    { wch: 26 }, // Obs. Do Pedido
    { wch: 22 }, // Natureza da Operação
    { wch: 22 }, // CNPJ da Transportadora
    { wch: 16 }, // Código do Item
    { wch: 22 }, // Código de Barras do Item
    { wch: 20 }, // Referência do Item
    { wch: 14 }, // Qtde. Do Item
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')

  // Generate and download .xlsx file
  const fileName = `pedido_padronizado_${Date.now()}.xlsx`
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary' })
}
