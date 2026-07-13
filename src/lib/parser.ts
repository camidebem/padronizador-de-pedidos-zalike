import { OrderHeader, OrderItem } from '@/hooks/use-order'

/**
 * Simulates parsing a PDF or Excel file locally in the browser.
 * In a real scenario, this would use pdfjs-dist or xlsx libraries.
 */
export async function processFile(
  file: File,
): Promise<{ header: OrderHeader; items: OrderItem[] }> {
  return new Promise((resolve) => {
    // Simulate processing delay
    setTimeout(() => {
      resolve({
        header: {
          cnpj: '45.123.456/0001-99',
          repCode: '',
          paymentCode: '',
          paymentDesc: '',
          obs: 'Entrega preferencialmente no período da tarde. Cliente possui restrição de horário.',
          nature: 'Venda',
        },
        items: [
          {
            id: crypto.randomUUID(),
            itemCode: '',
            barcode: '7891000315507',
            reference: 'REF-A1',
            qty: '20',
          },
          {
            id: crypto.randomUUID(),
            itemCode: '',
            barcode: '7891000315514',
            reference: 'REF-B2',
            qty: '15',
          },
          {
            id: crypto.randomUUID(),
            itemCode: '',
            barcode: '7891000315521',
            reference: 'REF-C3',
            qty: '50',
          },
          {
            id: crypto.randomUUID(),
            itemCode: '',
            barcode: '7891000315538',
            reference: 'REF-D4',
            qty: '5',
          },
        ],
      })
    }, 2000)
  })
}
