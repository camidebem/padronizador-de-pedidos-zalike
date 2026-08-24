import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { OrderItem } from '@/hooks/use-order'
import { Trash2, Package, Search, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { apiBuscarProdutoPorCodigo, ProdutoMySQLResult } from '@/lib/mysql-client'

interface Props {
  items: OrderItem[]
  idCliente?: number
  idConvenio?: number
  onChange: (id: string, field: keyof OrderItem, value: string) => void
  onRemove: (id: string) => void
  onItemAutoFilled?: (id: string, produto: ProdutoMySQLResult) => void
}

export function ReviewItemsTable({
  items,
  idCliente,
  onChange,
  onRemove,
  onItemAutoFilled,
}: Props) {
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null)
  const [itemStatuses, setItemStatuses] = useState<
    Record<string, { type: 'success' | 'not_found' | 'error'; msg: string }>
  >({})
  const [isBulkSearching, setIsBulkSearching] = useState(false)

  const handleLookupProduct = async (itemId: string, valor: string, force = false) => {
    if (!valor || !idCliente) {
      return
    }

    setLoadingItemId(itemId)
    try {
      const { produto, configured, error } = await apiBuscarProdutoPorCodigo(idCliente, valor)

      if (!configured) {
        setItemStatuses((prev) => ({
          ...prev,
          [itemId]: { type: 'error', msg: 'Senha MySQL não configurada' },
        }))
        return
      }

      if (error && !produto) {
        setItemStatuses((prev) => ({
          ...prev,
          [itemId]: { type: 'error', msg: error },
        }))
        return
      }

      if (produto && produto.produto_codigo) {
        onChange(itemId, 'itemCode', produto.produto_codigo)
        if (produto.referencia && !items.find((i) => i.id === itemId)?.reference) {
          onChange(itemId, 'reference', produto.referencia)
        }
        if (produto.codbarra && !items.find((i) => i.id === itemId)?.barcode) {
          onChange(itemId, 'barcode', produto.codbarra)
        }

        setItemStatuses((prev) => ({
          ...prev,
          [itemId]: { type: 'success', msg: `Cód. ${produto.produto_codigo} encontrado` },
        }))

        if (onItemAutoFilled) {
          onItemAutoFilled(itemId, produto)
        }
      } else {
        setItemStatuses((prev) => ({
          ...prev,
          [itemId]: { type: 'not_found', msg: 'Produto não localizado' },
        }))
      }
    } catch (err: any) {
      setItemStatuses((prev) => ({
        ...prev,
        [itemId]: { type: 'error', msg: 'Erro na consulta' },
      }))
    } finally {
      setLoadingItemId(null)
    }
  }

  // Busca todos os itens pendentes
  const handleLookupAllItems = async () => {
    if (!idCliente || items.length === 0) return

    setIsBulkSearching(true)
    for (const item of items) {
      const searchVal = item.barcode || item.reference || item.itemCode
      if (searchVal && (!item.itemCode || item.itemCode.trim() === '')) {
        await handleLookupProduct(item.id, searchVal, true)
      }
    }
    setIsBulkSearching(false)
  }

  if (items.length === 0) {
    return (
      <Card className="shadow-subtle border-slate-200">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium text-lg">Nenhum item encontrado.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-subtle border-slate-200 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-800">
              <Package className="w-5 h-5 text-primary" />
              Itens do Pedido ({items.length})
            </CardTitle>
            <CardDescription className="mt-1">
              {idCliente
                ? 'Preenchimento automático ativo via EAN, Referência ou Cód. Cliente no MySQL.'
                : 'Informe o CNPJ do cliente acima para habilitar o preenchimento automático de códigos de produtos.'}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {idCliente && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLookupAllItems}
                disabled={isBulkSearching}
                className="text-xs h-8 gap-1.5 border-slate-300 bg-white"
              >
                {isBulkSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                )}
                Buscar todos pendentes
              </Button>
            )}
            <Badge variant="secondary" className="font-medium bg-slate-100 text-slate-700">
              {items.filter((i) => i.itemCode.trim()).length}/{items.length} com código
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[180px] font-semibold">Cód. Interno *</TableHead>
                <TableHead className="font-semibold">Cód. Barras (EAN)</TableHead>
                <TableHead className="font-semibold">Referência</TableHead>
                <TableHead className="w-[120px] font-semibold text-right">Qtde.</TableHead>
                <TableHead className="w-[90px] text-center font-semibold">Buscar</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isLoading = loadingItemId === item.id
                const status = itemStatuses[item.id]
                const hasCode = Boolean(item.itemCode && item.itemCode.trim())

                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="p-2">
                      <div className="space-y-1">
                        <Input
                          value={item.itemCode}
                          onChange={(e) => onChange(item.id, 'itemCode', e.target.value)}
                          onBlur={() => {
                            if (item.itemCode && idCliente && !hasCode) {
                              handleLookupProduct(item.id, item.itemCode)
                            }
                          }}
                          placeholder="Ex: 9982"
                          className={`h-9 font-medium ${
                            !hasCode
                              ? 'border-amber-300 bg-amber-50/30 placeholder:text-amber-700/50'
                              : 'border-slate-300 focus-visible:ring-1 focus-visible:ring-primary'
                          }`}
                        />
                        {status && (
                          <div
                            className={`text-[11px] flex items-center gap-1 font-medium ${
                              status.type === 'success'
                                ? 'text-emerald-600'
                                : status.type === 'not_found'
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                            }`}
                          >
                            {status.type === 'success' && <CheckCircle className="w-3 h-3" />}
                            {status.type === 'not_found' && <AlertCircle className="w-3 h-3" />}
                            {status.type === 'error' && <AlertCircle className="w-3 h-3" />}
                            <span className="truncate max-w-[150px]">{status.msg}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={item.barcode}
                        onChange={(e) => onChange(item.id, 'barcode', e.target.value)}
                        onBlur={() => {
                          if (item.barcode && idCliente && !hasCode) {
                            handleLookupProduct(item.id, item.barcode)
                          }
                        }}
                        placeholder="EAN / Código de barras"
                        className="h-9 font-mono text-sm text-slate-600 bg-slate-50/70"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={item.reference}
                        onChange={(e) => onChange(item.id, 'reference', e.target.value)}
                        onBlur={() => {
                          if (item.reference && idCliente && !hasCode) {
                            handleLookupProduct(item.id, item.reference)
                          }
                        }}
                        placeholder="Ref. do Produto"
                        className="h-9 text-slate-600 bg-slate-50/70"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={item.qty}
                        onChange={(e) => onChange(item.id, 'qty', e.target.value)}
                        className="h-9 text-right font-medium"
                        type="number"
                        min="1"
                      />
                    </TableCell>
                    <TableCell className="p-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={
                          isLoading ||
                          !idCliente ||
                          (!item.barcode && !item.reference && !item.itemCode)
                        }
                        onClick={() => {
                          const val = item.barcode || item.reference || item.itemCode
                          if (val) handleLookupProduct(item.id, val, true)
                        }}
                        title={
                          !idCliente
                            ? 'Informe o CNPJ do cliente primeiro'
                            : 'Buscar código do produto no MySQL'
                        }
                        className="h-8 px-2 text-slate-500 hover:text-primary hover:bg-primary/10"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="p-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(item.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
