import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrderHeader } from '@/hooks/use-order'
import { buscarClientePorCNPJ } from '@/lib/mysql-client'
import { Building2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  header: OrderHeader
  onChange: (header: OrderHeader) => void
}

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export function ReviewHeaderForm({ header, onChange }: Props) {
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>(
    header.idCliente ? 'found' : 'idle',
  )
  const [clientInfo, setClientInfo] = useState<{
    nome?: string
    fantasia?: string
  }>({})

  // Referência para controlar o último CNPJ buscado e evitar buscas redundantes
  const lastSearchedCnpj = useRef<string>(header.cnpj.replace(/\D/g, ''))
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performLookup = async (rawCnpj: string) => {
    const digits = rawCnpj.replace(/\D/g, '')
    if (digits.length < 14) {
      setLookupStatus('idle')
      return
    }

    if (digits === lastSearchedCnpj.current && lookupStatus !== 'idle') {
      return
    }

    lastSearchedCnpj.current = digits
    setLookupStatus('loading')

    try {
      // 1 única tentativa com timeout via Edge Function
      const data = await buscarClientePorCNPJ(rawCnpj)

      if (data) {
        setLookupStatus('found')
        setClientInfo({
          nome: data.nome,
          fantasia: data.fantasia,
        })

        // Atualiza campos apenas se não foram preenchidos manualmente pelo usuário
        onChange({
          ...header,
          cnpj: rawCnpj,
          idCliente: data.id_cliente,
          idConvenio: data.id_convenio,
          repCode: header.repCode.trim() ? header.repCode : data.id_vendedor,
          paymentCode: header.paymentCode.trim() ? header.paymentCode : data.forma_pagto_codigo,
          paymentDesc: header.paymentDesc.trim() ? header.paymentDesc : data.forma_pagto_descricao,
        })
      } else {
        setLookupStatus('not_found')
        setClientInfo({})
      }
    } catch (err) {
      console.warn('[ReviewHeaderForm] Erro ao buscar cliente por CNPJ:', err)
      setLookupStatus('error')
    }
  }

  // Monitora alterações no CNPJ com debounce de 600ms
  const handleCnpjChange = (value: string) => {
    onChange({ ...header, cnpj: value })

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const digits = value.replace(/\D/g, '')
    if (digits.length >= 14) {
      debounceTimerRef.current = setTimeout(() => {
        performLookup(value)
      }, 600)
    } else {
      setLookupStatus('idle')
    }
  }

  // Caso o usuário saia do campo antes do debounce terminar
  const handleCnpjBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    const digits = header.cnpj.replace(/\D/g, '')
    if (digits.length >= 14 && digits !== lastSearchedCnpj.current) {
      performLookup(header.cnpj)
    }
  }

  useEffect(() => {
    // Se o header já tiver CNPJ mas ainda não buscou (ex: importado do arquivo)
    const digits = header.cnpj.replace(/\D/g, '')
    if (digits.length >= 14 && !header.idCliente && lookupStatus === 'idle') {
      performLookup(header.cnpj)
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [header.cnpj])

  const handleChange = (field: keyof OrderHeader, value: string) => {
    onChange({ ...header, [field]: value })
  }

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5 text-primary" />
            Informações Gerais do Pedido
          </CardTitle>

          {lookupStatus === 'loading' && (
            <Badge
              variant="outline"
              className="text-primary border-primary/30 flex items-center gap-1.5 w-fit"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Buscando cliente no ERP...
            </Badge>
          )}

          {lookupStatus === 'found' && (
            <Badge
              variant="outline"
              className="text-emerald-700 bg-emerald-50 border-emerald-300 flex items-center gap-1.5 w-fit"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Cliente localizado{' '}
              {clientInfo.fantasia || clientInfo.nome
                ? `(${clientInfo.fantasia || clientInfo.nome})`
                : ''}
            </Badge>
          )}

          {lookupStatus === 'not_found' && (
            <Badge
              variant="outline"
              className="text-amber-700 bg-amber-50 border-amber-300 flex items-center gap-1.5 w-fit"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              CNPJ não encontrado na base
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CNPJ do Cliente */}
          <div className="space-y-2">
            <Label htmlFor="cnpj" className="text-slate-600 font-medium flex items-center gap-2">
              CNPJ do Cliente *
              {lookupStatus === 'loading' && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              )}
            </Label>
            <Input
              id="cnpj"
              value={header.cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              onBlur={handleCnpjBlur}
              placeholder="00.000.000/0000-00"
              className={`font-medium ${
                lookupStatus === 'found' ? 'border-emerald-300 focus-visible:ring-emerald-400' : ''
              }`}
            />
          </div>

          {/* Código do Representante */}
          <div className="space-y-2">
            <Label htmlFor="repCode" className="text-slate-600">
              Código do representante *
            </Label>
            <Input
              id="repCode"
              value={header.repCode}
              onChange={(e) => handleChange('repCode', e.target.value)}
              placeholder="Digite o código"
              className={header.repCode ? 'border-slate-300' : 'border-amber-300 bg-amber-50/20'}
            />
          </div>

          {/* Código Forma de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="paymentCode" className="text-slate-600">
              Código forma de pagamento *
            </Label>
            <Input
              id="paymentCode"
              value={header.paymentCode}
              onChange={(e) => handleChange('paymentCode', e.target.value)}
              placeholder="Ex: 001"
              className={
                header.paymentCode ? 'border-slate-300' : 'border-amber-300 bg-amber-50/20'
              }
            />
          </div>

          {/* Descrição Forma de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="paymentDesc" className="text-slate-600">
              Descrição forma de pagamento
            </Label>
            <Input
              id="paymentDesc"
              value={header.paymentDesc}
              onChange={(e) => handleChange('paymentDesc', e.target.value)}
              placeholder="Ex: Boleto 30/60"
            />
          </div>

          {/* Observações */}
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

          {/* Natureza da Operação */}
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
