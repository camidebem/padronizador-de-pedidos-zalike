import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderHeader } from '@/hooks/use-order'
import { Building2 } from 'lucide-react'

interface Props {
  header: OrderHeader
  onChange: (header: OrderHeader) => void
}

export function ReviewHeaderForm({ header, onChange }: Props) {
  const handleChange = (field: keyof OrderHeader, value: string) => {
    onChange({ ...header, [field]: value })
  }

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-800">
          <Building2 className="w-5 h-5 text-primary" />
          Informações Gerais do Pedido
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="cnpj" className="text-slate-600">
              CNPJ do Cliente *
            </Label>
            <Input
              id="cnpj"
              value={header.cnpj}
              onChange={(e) => handleChange('cnpj', e.target.value)}
              className="font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repCode" className="text-slate-600">
              Cód. Representante *
            </Label>
            <Input
              id="repCode"
              value={header.repCode}
              onChange={(e) => handleChange('repCode', e.target.value)}
              placeholder="Digite o código"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentCode" className="text-slate-600">
              Cód. F. Pagto *
            </Label>
            <Input
              id="paymentCode"
              value={header.paymentCode}
              onChange={(e) => handleChange('paymentCode', e.target.value)}
              placeholder="Ex: 001"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentDesc" className="text-slate-600">
              Descrição da F. Pagto
            </Label>
            <Input
              id="paymentDesc"
              value={header.paymentDesc}
              onChange={(e) => handleChange('paymentDesc', e.target.value)}
              placeholder="Ex: Boleto 30/60"
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="obs" className="text-slate-600">
              Obs. do Pedido
            </Label>
            <Input
              id="obs"
              value={header.obs}
              onChange={(e) => handleChange('obs', e.target.value)}
              placeholder="Observações adicionais..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nature" className="text-slate-600">
              Natureza da Operação *
            </Label>
            <Input
              id="nature"
              value={header.nature}
              onChange={(e) => handleChange('nature', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
