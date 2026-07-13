import { createContext, useContext, useState, ReactNode } from 'react'

export interface OrderHeader {
  cnpj: string
  repCode: string
  paymentCode: string
  paymentDesc: string
  obs: string
  nature: string
}

export interface OrderItem {
  id: string
  itemCode: string
  barcode: string
  reference: string
  qty: string
}

interface OrderContextType {
  header: OrderHeader | null
  items: OrderItem[]
  setHeader: (header: OrderHeader | null) => void
  setItems: (items: OrderItem[]) => void
  clearOrder: () => void
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export function OrderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<OrderHeader | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])

  const clearOrder = () => {
    setHeader(null)
    setItems([])
  }

  return (
    <OrderContext.Provider value={{ header, items, setHeader, setItems, clearOrder }}>
      {children}
    </OrderContext.Provider>
  )
}

export function useOrder() {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider')
  }
  return context
}
