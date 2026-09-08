import { OrderHeader, OrderItem } from '@/hooks/use-order'
import { processFilePipeline } from './pipeline'

/**
 * Backward-compatible processFile function.
 * Runs the full real extraction pipeline and returns the first extracted order.
 */
export async function processFile(
  file: File,
): Promise<{ header: OrderHeader; items: OrderItem[] }> {
  const result = await processFilePipeline(file)
  if (result.orders.length > 0) {
    return {
      header: result.orders[0].header,
      items: result.orders[0].items,
    }
  }

  return {
    header: {
      cnpj: '',
      repCode: '',
      paymentCode: '',
      paymentDesc: '',
      obs: '',
      nature: 'Venda',
    },
    items: [],
  }
}
