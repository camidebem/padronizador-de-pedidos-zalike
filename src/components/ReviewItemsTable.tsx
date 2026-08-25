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
import { Trash2, Package } from 'lucide-react'

interface Props {
  items: OrderItem[]
  onChange: (id: string, field: keyof OrderItem, value: string) => void
  onRemove: (id: string) => void
}

export function ReviewItemsTable({ items, onChange, onRemove }: Props) {
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
              Revise e edite as informações dos itens extraídos da ordem de compra.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
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
                <TableHead className="w-[200px] font-semibold">Código Interno *</TableHead>
                <TableHead className="font-semibold">Cód. Barras (EAN)</TableHead>
                <TableHead className="font-semibold">Referência</TableHead>
                <TableHead className="w-[120px] font-semibold text-right">Qtde.</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const hasCode = Boolean(item.itemCode && item.itemCode.trim())

                return (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="p-2">
                      <Input
                        value={item.itemCode}
                        onChange={(e) => onChange(item.id, 'itemCode', e.target.value)}
                        placeholder="Ex: 9982"
                        className={`h-9 font-medium ${
                          !hasCode
                            ? 'border-amber-300 bg-amber-50/30 placeholder:text-amber-700/50'
                            : 'border-slate-300 focus-visible:ring-1 focus-visible:ring-primary'
                        }`}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={item.barcode}
                        onChange={(e) => onChange(item.id, 'barcode', e.target.value)}
                        placeholder="EAN / Código de barras"
                        className="h-9 font-mono text-sm text-slate-600 bg-slate-50/70"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={item.reference}
                        onChange={(e) => onChange(item.id, 'reference', e.target.value)}
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
