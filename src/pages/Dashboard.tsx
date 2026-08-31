import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useOrder } from '@/hooks/use-order'
import { processFile } from '@/lib/parser'
import { enrichHeaderFromCnpj, enrichItemsWithIdCliente } from '@/lib/erp'
import { useToast } from '@/hooks/use-toast'

export default function Dashboard() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { setHeader, setItems } = useOrder()
  const { toast } = useToast()

  const handleFile = async (file: File) => {
    const isValidType =
      file.type === 'application/pdf' ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    if (!isValidType) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, envie apenas arquivos PDF ou Excel (.xlsx, .xls).',
      })
      return
    }

    setIsProcessing(true)
    try {
      const data = await processFile(file)

      // Fluxo 1 e 2 do preenchimento automático (MySQL externo via
      // zalike-erp-bridge): busca o cliente pelo CNPJ extraído e, com o
      // idCliente resolvido, o código interno de cada item. Ambos
      // degradam para os campos manuais existentes se o bridge não
      // estiver configurado, o cliente/produto não for encontrado, ou o
      // banco externo estiver indisponível.
      const enrichedHeader = await enrichHeaderFromCnpj(data.header)
      const enrichedItems = await enrichItemsWithIdCliente(data.items, enrichedHeader.idCliente)

      setHeader(enrichedHeader)
      setItems(enrichedItems)
      toast({
        title: 'Sucesso',
        description: 'Dados extraídos com sucesso. Revise as informações.',
      })
      navigate('/review')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no processamento',
        description: 'Não foi possível ler o arquivo. Tente novamente.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Importação de Pedidos</h1>
        <p className="text-slate-500 mt-2">
          Arraste seus arquivos PDF ou Excel para iniciar a extração e padronização.
        </p>
      </div>

      <Card
        className={`border-2 border-dashed transition-all duration-200 overflow-hidden ${
          isDragging ? 'border-primary bg-primary/5' : 'border-slate-300 bg-white'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-12">
            {isProcessing ? (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Extraindo dados do pedido...
                </h3>
                <p className="text-slate-500 max-w-sm">
                  Isso pode levar alguns segundos dependendo do tamanho do arquivo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  Arraste o arquivo aqui
                </h3>
                <p className="text-slate-500 max-w-sm mb-8">
                  Suporta arquivos de representação em{' '}
                  <span className="font-medium text-slate-700">PDF</span> ou planilhas{' '}
                  <span className="font-medium text-slate-700">Excel</span>.
                </p>
                <div className="flex gap-4 mb-8">
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border">
                    <FileText className="w-4 h-4 text-rose-500" /> .pdf
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> .xlsx
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary font-medium hover:underline focus:outline-none"
                >
                  Ou clique para selecionar o arquivo
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                  accept=".pdf,.xlsx,.xls"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
