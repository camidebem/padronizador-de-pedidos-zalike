import { useState, useRef, useEffect } from 'react'
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
  CheckCircle2,
  Search,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  const [searchTerm, setSearchTerm] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { setHeader, setItems, setRawText, setCurrentOrderId, setCurrentOrderNumber } = useOrder()
  const { toast } = useToast()

  // Restore state from sessionStorage if user navigates back from review
  useEffect(() => {
    try {
      const savedResult = sessionStorage.getItem('zalike_active_extraction')
      if (savedResult) {
        setExtractionResult(JSON.parse(savedResult))
      }
      const savedProcessed = sessionStorage.getItem('zalike_processed_orders')
      if (savedProcessed) {
        setProcessedOrderIds(new Set(JSON.parse(savedProcessed)))
      }
    } catch {
      /* intentionally ignored */
    }
  }, [])

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
        try {
          sessionStorage.removeItem('zalike_active_extraction')
          sessionStorage.removeItem('zalike_processed_orders')
        } catch {
          /* intentionally ignored */
        }
        await proceedToReview(singleOrder)
      } else {
        // Multiple orders detected: save in sessionStorage and show multi-order selection screen
        setExtractionResult(result)
        try {
          sessionStorage.setItem('zalike_active_extraction', JSON.stringify(result))
          sessionStorage.setItem('zalike_processed_orders', JSON.stringify([]))
        } catch {
          /* intentionally ignored */
        }
        toast({
          title: `${result.orders.length} pedidos detectados no arquivo`,
          description: 'Cada pedido foi isolado individualmente. Escolha qual revisar e exportar.',
        })
      }
    } catch (error) {
      console.error('[pipeline] Erro:', error)
      toast({
        variant: 'destructive',
        title: 'Erro no processamento',
        description:
          error instanceof Error
            ? error.message
            : 'Não foi possível ler o arquivo. Tente novamente.',
      })
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const proceedToReview = async (order: ExtractedOrder) => {
    setIsProcessing(true)
    setProcessingStatus(`Carregando pedido ${order.orderNumber || ''}...`)

    try {
      const enrichedHeader = await enrichHeaderFromCnpj(order.header)
      const enrichedItems = await enrichItemsWithIdCliente(order.items, enrichedHeader.idCliente)

      setHeader(enrichedHeader)
      setItems(enrichedItems)
      if (setRawText) {
        setRawText(order.rawText || '')
      }
      if (setCurrentOrderId) {
        setCurrentOrderId(order.id)
      }
      if (setCurrentOrderNumber) {
        setCurrentOrderNumber(order.orderNumber || '')
      }

      if (order.isOcr || order.confidence === 'low') {
        toast({
          variant: 'destructive',
          title: 'Atenção: Extração de baixa confiança',
          description:
            'Revise atentamente os códigos e quantidades. O texto original está disponível na tela.',
        })
      } else if (order.items.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Pedido sem itens automáticos',
          description: 'Insira os itens manualmente com o apoio do texto original.',
        })
      } else {
        toast({
          title: 'Pedido pronto para revisão',
          description: `Pedido ${order.orderNumber} com ${order.items.length} itens carregado.`,
        })
      }

      navigate('/review')
    } catch (err) {
      console.warn('[erp] Erro ao enriquecer pedido:', err)
      setHeader(order.header)
      setItems(order.items)
      if (setRawText) setRawText(order.rawText || '')
      if (setCurrentOrderId) setCurrentOrderId(order.id)
      if (setCurrentOrderNumber) setCurrentOrderNumber(order.orderNumber || '')
      navigate('/review')
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const handleResetSession = () => {
    setExtractionResult(null)
    setProcessedOrderIds(new Set())
    setSearchTerm('')
    try {
      sessionStorage.removeItem('zalike_active_extraction')
      sessionStorage.removeItem('zalike_processed_orders')
    } catch {
      /* intentionally ignored */
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
                Arquivo: <span className="font-medium">{extractionResult.fileName}</span>. Cada
                pedido deve ser revisado e exportado individualmente.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSession}
              className="gap-1 text-slate-600 shrink-0"
            >
              <RotateCcw className="w-4 h-4" /> Novo Arquivo
            </Button>
          </div>

          {extractionResult.warning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">{extractionResult.warning}</p>
                <p className="text-xs text-amber-700 mt-1">
                  Você pode abrir qualquer pedido e revisar ou editar os dados manualmente antes de
                  aprovar.
                </p>
              </div>
            </div>
          )}

          {/* Status summary & search filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                Total: {extractionResult.orders.length}
              </Badge>
              <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 inline" />
                Exportados: {processedOrderIds.size}
              </Badge>
              <Badge variant="outline" className="text-xs text-blue-700 border-blue-300">
                Pendentes: {extractionResult.orders.length - processedOrderIds.size}
              </Badge>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filtrar por pedido, CNPJ ou loja..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {extractionResult.orders
              .filter((ord, idx) => {
                if (!searchTerm.trim()) return true
                const query = searchTerm.toLowerCase().trim()
                const orderNum = (ord.orderNumber || `Pedido #${idx + 1}`).toLowerCase()
                const cnpj = (ord.header.cnpj || '').toLowerCase()
                const store = (ord.customerName || '').toLowerCase()
                return orderNum.includes(query) || cnpj.includes(query) || store.includes(query)
              })
              .map((ord, idx) => {
                const isAlreadyProcessed = processedOrderIds.has(ord.id)
                return (
                  <Card
                    key={ord.id}
                    className={`border transition-all ${
                      isAlreadyProcessed
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 hover:border-primary/50 hover:shadow-sm bg-white'
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
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Exportado
                            </Badge>
                          ) : ord.confidence === 'low' || ord.isOcr ? (
                            <Badge
                              variant="secondary"
                              className="text-amber-700 bg-amber-100 text-xs"
                            >
                              Baixa Confiança
                            </Badge>
                          ) : null}
                        </div>

                        <div className="space-y-1.5 text-sm text-slate-600 my-3">
                          {ord.customerName && (
                            <div className="flex items-center gap-2">
                              <Building className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="truncate font-medium text-slate-800">
                                {ord.customerName}
                              </span>
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

                      <div className="pt-4 border-t mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400 truncate max-w-[140px]">
                          {ord.header.obs || ''}
                        </span>
                        <Button
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => proceedToReview(ord)}
                          variant={isAlreadyProcessed ? 'outline' : 'default'}
                          className="gap-1.5 shrink-0"
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
                    Pipeline ativo: leitura client-side (PDF/XLSX), separação por pedido e
                    normalização via IA.
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
