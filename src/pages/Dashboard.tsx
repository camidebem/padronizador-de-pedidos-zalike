import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Loader2,
  Layers,
  ArrowRight,
  AlertTriangle,
  Building,
  Hash,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrder } from '@/hooks/use-order'
import { processFilePipeline } from '@/lib/pipeline'
import { ExtractedOrder, ExtractionResult } from '@/lib/extractor-types'
import { enrichHeaderFromCnpj, enrichItemsWithIdCliente } from '@/lib/erp'
import { useToast } from '@/hooks/use-toast'

export default function Dashboard() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [processedOrderIds, setProcessedOrderIds] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { setHeader, setItems, setRawText } = useOrder()
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
    setProcessingStatus('Iniciando pipeline de extração...')
    setExtractionResult(null)

    try {
      const result = await processFilePipeline(file, (status) => {
        setProcessingStatus(status)
      })

      if (result.orders.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum pedido detectado',
          description: 'Não foi possível estruturar nenhum pedido do arquivo.',
        })
        return
      }

      // If exactly 1 order, enrich and go straight to review
      if (result.orders.length === 1) {
        const singleOrder = result.orders[0]
        await proceedToReview(singleOrder)
      } else {
        // Multiple orders detected: show multi-order selection screen
        setExtractionResult(result)
        toast({
          title: `${result.orders.length} pedidos detectados`,
          description: 'Selecione abaixo qual pedido deseja revisar e exportar.',
        })
      }
    } catch (error) {
      console.error('[pipeline] Erro:', error)
      toast({
        variant: 'destructive',
        title: 'Erro no processamento',
        description: error instanceof Error ? error.message : 'Não foi possível ler o arquivo. Tente novamente.',
      })
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const proceedToReview = async (order: ExtractedOrder) => {
    setIsProcessing(true)
    setProcessingStatus('Consultando cliente e produtos no ERP...')

    try {
      const enrichedHeader = await enrichHeaderFromCnpj(order.header)
      const enrichedItems = await enrichItemsWithIdCliente(order.items, enrichedHeader.idCliente)

      setHeader(enrichedHeader)
      setItems(enrichedItems)
      if (setRawText) {
        setRawText(order.rawText || '')
      }

      setProcessedOrderIds((prev) => new Set(prev).add(order.id))

      if (order.isOcr) {
        toast({
          variant: 'destructive',
          title: 'Atenção: Extração por OCR',
          description: 'Documento escaneado. Revise atentamente quantidades e códigos.',
        })
      } else {
        toast({
          title: 'Pedido pronto para revisão',
          description: `Pedido ${order.orderNumber} carregado com sucesso.`,
        })
      }

      navigate('/review')
    } catch (err) {
      console.warn('[erp] Erro ao enriquecer pedido:', err)
      setHeader(order.header)
      setItems(order.items)
      if (setRawText) setRawText(order.rawText || '')
      navigate('/review')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
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

      {extractionResult && extractionResult.orders.length > 1 ? (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-900">
                  {extractionResult.orders.length} pedidos encontrados no arquivo
                </h2>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Arquivo: <span className="font-medium">{extractionResult.fileName}</span>. Cada pedido deve ser revisado e exportado individualmente.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExtractionResult(null)
                setProcessedOrderIds(new Set())
              }}
              className="gap-1 text-slate-600"
            >
              <RotateCcw className="w-4 h-4" /> Novo Arquivo
            </Button>
          </div>

          {extractionResult.warning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800">{extractionResult.warning}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extractionResult.orders.map((ord, idx) => {
              const isAlreadyProcessed = processedOrderIds.has(ord.id)
              return (
                <Card
                  key={ord.id}
                  className={`border transition-all ${
                    isAlreadyProcessed
                      ? 'border-emerald-200 bg-emerald-50/40 opacity-80'
                      : 'hover:border-primary/50 hover:shadow-sm'
                  }`}
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{idx + 1}
                          </Badge>
                          <span className="font-semibold text-slate-900 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5 text-slate-400" />
                            {ord.orderNumber || `Pedido #${idx + 1}`}
                          </span>
                        </div>
                        {isAlreadyProcessed ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs">
                            Exportado
                          </Badge>
                        ) : ord.confidence === 'low' ? (
                          <Badge variant="secondary" className="text-amber-700 bg-amber-100 text-xs">
                            Baixa Confiança
                          </Badge>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 text-sm text-slate-600 my-3">
                        {ord.customerName && (
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate font-medium text-slate-800">{ord.customerName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono">CNPJ:</span>
                          <span className="font-mono text-xs text-slate-700">
                            {ord.header.cnpj || 'Não informado'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>
                            <strong className="text-slate-900">{ord.items.length}</strong>{' '}
                            {ord.items.length === 1 ? 'item' : 'itens'} identificados
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {ord.header.obs ? ord.header.obs.slice(0, 40) + '...' : ''}
                      </span>
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => proceedToReview(ord)}
                        className="gap-1.5"
                      >
                        {isAlreadyProcessed ? 'Revisar novamente' : 'Revisar este Pedido'}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
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
                    {processingStatus || 'Processando arquivo...'}
                  </h3>
                  <p className="text-slate-500 max-w-sm">
                    Pipeline ativo: leitura client-side (PDF/XLSX), separação por pedido e normalização via IA.
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
                    Suporta arquivos com múltiplos pedidos em{' '}
                    <span className="font-medium text-slate-700">PDF</span> ou planilhas{' '}
                    <span className="font-medium text-slate-700">Excel</span>.
                  </p>
                  <div className="flex gap-4 mb-8">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border">
                      <FileText className="w-4 h-4 text-rose-500" /> .pdf (1 ou vários pedidos)
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> .xlsx / .xls
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
      )}
    </div>
  )
}
