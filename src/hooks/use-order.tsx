import { createContext, useContext, useState, ReactNode } from 'react'

export interface OrderHeader {
  cnpj: string
  repCode: string
  paymentCode: string
  paymentDesc: string
  obs: string
  nature: string
  /**
   * id_cliente resolvido no MySQL externo a partir do CNPJ (Fluxo 1 do
   * preenchimento automático). Não faz parte do CSV exportado — só existe
   * para viabilizar a busca de produto por item (Fluxo 2). Nulo/ausente
   * enquanto o CNPJ não for encontrado na base ou não tiver sido buscado.
   */
  idCliente?: string | null
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
