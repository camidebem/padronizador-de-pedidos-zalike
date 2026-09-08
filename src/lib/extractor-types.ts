import { OrderHeader, OrderItem } from '@/hooks/use-order'

export interface ExtractedOrder {
  id: string
  orderNumber: string
  customerName?: string
  confidence: 'high' | 'low' | 'manual'
  isOcr?: boolean
  rawText?: string
  header: OrderHeader
  items: OrderItem[]
  warning?: string
}

export interface ExtractionResult {
  fileName: string
  fileType: 'pdf' | 'excel'
  orders: ExtractedOrder[]
  totalOrders: number
  isOcr: boolean
  rawTextPreview?: string
  warning?: string
}
