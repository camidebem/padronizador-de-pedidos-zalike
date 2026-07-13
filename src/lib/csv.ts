import { OrderHeader, OrderItem } from '@/hooks/use-order'

/**
 * Generates and triggers the download of the required CSV format.
 */
export function generateCSV(header: OrderHeader, items: OrderItem[]): void {
  const columns = [
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
  ]

  const rows = [columns.join(';')]

  for (const item of items) {
    const rowData = [
      header.cnpj,
      header.repCode,
      header.paymentCode,
      header.paymentDesc,
      header.obs,
      header.nature,
      '', // CNPJ da Transportadora (Always empty)
      item.itemCode,
      item.barcode,
      item.reference,
      item.qty,
    ]

    // Escape quotes and wrap in quotes to prevent issue with semicolons in data
    const escapedRow = rowData.map((val) => `"${(val || '').toString().replace(/"/g, '""')}"`)
    rows.push(escapedRow.join(';'))
  }

  // Prepend BOM for Excel UTF-8 support
  const csvContent = '\ufeff' + rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `pedido_padronizado_${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
