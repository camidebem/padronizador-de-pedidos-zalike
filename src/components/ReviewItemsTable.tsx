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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-800">
              <Package className="w-5 h-5 text-primary" />
              Itens Extraídos
            </CardTitle>
            <CardDescription className="mt-1">
              Revise as informações e preencha os códigos faltantes.
            </CardDescription>
          </div>
          <div className="text-sm font-medium bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            {items.length} {items.length === 1 ? 'item' : 'itens'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[150px] font-semibold">Cód. Interno *</TableHead>
                <TableHead className="font-semibold">Cód. Barras</TableHead>
                <TableHead className="font-semibold">Referência</TableHead>
                <TableHead className="w-[120px] font-semibold text-right">Qtde.</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="p-2">
                    <Input
                      value={item.itemCode}
                      onChange={(e) => onChange(item.id, 'itemCode', e.target.value)}
                      placeholder="Ex: 9982"
                      className="h-9 focus-visible:ring-1 focus-visible:ring-primary border-slate-300"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      value={item.barcode}
                      onChange={(e) => onChange(item.id, 'barcode', e.target.value)}
                      className="h-9 font-mono text-sm text-slate-600 bg-slate-50"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      value={item.reference}
                      onChange={(e) => onChange(item.id, 'reference', e.target.value)}
                      className="h-9 text-slate-600 bg-slate-50"
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
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(item.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-9 w-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
