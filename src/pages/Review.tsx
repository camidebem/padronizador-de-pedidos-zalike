import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrder, OrderHeader, OrderItem } from '@/hooks/use-order'
import { useToast } from '@/hooks/use-toast'
import { generateCSV } from '@/lib/csv'
import { Button } from '@/components/ui/button'
import { ReviewHeaderForm } from '@/components/ReviewHeaderForm'
import { ReviewItemsTable } from '@/components/ReviewItemsTable'
import { CheckCircle, XCircle } from 'lucide-react'

export default function Review() {
  const navigate = useNavigate()
  const { header, items, clearOrder } = useOrder()
  const { toast } = useToast()

  // Local state for edits
  const [localHeader, setLocalHeader] = useState<OrderHeader | null>(null)
  const [localItems, setLocalItems] = useState<OrderItem[]>([])

  useEffect(() => {
    if (!header || items.length === 0) {
      navigate('/dashboard')
    } else {
      setLocalHeader(header)
      setLocalItems(items)
    }
  }, [header, items, navigate])

  if (!localHeader) return null

  const handleItemChange = (id: string, field: keyof OrderItem, value: string) => {
    setLocalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const handleRemoveItem = (id: string) => {
    setLocalItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleCancel = () => {
    clearOrder()
    navigate('/dashboard')
  }

  const handleApprove = () => {
    // Validation
    if (
      !localHeader.cnpj ||
      !localHeader.repCode ||
      !localHeader.paymentCode ||
      !localHeader.nature
    ) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha CNPJ, Cód. Representante, Cód. F. Pagto e Natureza da Operação.',
      })
      return
    }

    const hasEmptyItemCode = localItems.some((item) => !item.itemCode.trim())
    if (hasEmptyItemCode) {
      toast({
        variant: 'destructive',
        title: 'Códigos pendentes',
        description: 'Todos os itens precisam de um Código Interno preenchido.',
      })
      return
    }

    if (localItems.length === 0) {
      toast({ variant: 'destructive', description: 'O pedido precisa ter pelo menos um item.' })
      return
    }

    // Success - generate file
    generateCSV(localHeader, localItems)

    toast({
      title: 'Exportação concluída',
      description: 'O arquivo CSV foi gerado com sucesso.',
    })

    clearOrder()
    navigate('/dashboard')
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-24">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revisão de Dados</h1>
        <p className="text-slate-500 mt-2">
          Valide as informações extraídas e preencha os dados faltantes antes de exportar.
        </p>
      </div>

      <ReviewHeaderForm header={localHeader} onChange={setLocalHeader} />
      <ReviewItemsTable
        items={localItems}
        onChange={handleItemChange}
        onRemove={handleRemoveItem}
        idCliente={localHeader.idCliente}
      />

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between sm:justify-end gap-4 px-4 md:px-8">
          <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto h-11">
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar e Voltar
          </Button>
          <Button
            onClick={handleApprove}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white h-11 px-8 text-base shadow-sm transition-colors"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Aprovar e Gerar CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
