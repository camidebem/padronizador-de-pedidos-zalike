import { createContext, useContext, useState, ReactNode } from 'react'

export interface OrderHeader {
  cnpj: string
  repCode: string
  paymentCode: string
  paymentDesc: string
  obs: string
  nature: string
  // Dados sincronizados do MySQL
  idCliente?: number
  idConvenio?: number
  clientName?: string
  clientFantasia?: string
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
  updateHeader?: (newHeader: Partial<OrderHeader>) => void
  setItems: (items: OrderItem[]) => void
  clearOrder: () => void
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export function OrderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<OrderHeader | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])

  const updateHeader = (newHeader: Partial<OrderHeader>) => {
    setHeader((prev) => (prev ? { ...prev, ...newHeader } : null))
  }

  const clearOrder = () => {
    setHeader(null)
    setItems([])
  }

  return (
    <OrderContext.Provider
      value={{
        header,
        items,
        setHeader,
        updateHeader,
        setItems,
        clearOrder,
      }}
    >
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
