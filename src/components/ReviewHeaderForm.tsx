import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrderHeader } from '@/hooks/use-order'
import { Building2, Search, Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { apiBuscarClientePorCNPJ, ClienteMySQLResult } from '@/lib/mysql-client'

interface Props {
  header: OrderHeader
  onChange: (header: OrderHeader) => void
  onClientFound?: (client: ClienteMySQLResult) => void
}

export function ReviewHeaderForm({ header, onChange, onClientFound }: Props) {
  const [isSearching, setIsSearching] = useState(false)
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const lastSearchedCnpj = useRef<string>('')

  const handleChange = (field: keyof OrderHeader, value: string) => {
    onChange({ ...header, [field]: value })
  }

  const handleBuscarCliente = useCallback(
    async (cnpjToSearch: string, force = false) => {
      const raw = (cnpjToSearch || '').trim()
      const cleanDigits = raw.replace(/\D/g, '')

      // Se for muito curto e não for force, aguarda ter tamanho de CNPJ
      if (!force && cleanDigits.length < 14 && raw.length < 14) {
        return
      }

      if (!force && lastSearchedCnpj.current === raw) {
        return
      }

      lastSearchedCnpj.current = raw
      setIsSearching(true)
      setSearchStatus('idle')
      setStatusMessage('')

      try {
        const { cliente, configured, error } = await apiBuscarClientePorCNPJ(raw)

        if (!configured) {
          setSearchStatus('error')
          setStatusMessage('MYSQL_PASSWORD não configurada no Skip Cloud.')
          return
        }

        if (error && !cliente) {
          setSearchStatus('error')
          setStatusMessage(error)
          return
        }

        if (cliente) {
          setSearchStatus('found')
          setStatusMessage(`Cliente: ${cliente.fantasia || cliente.nome}`)

          // Atualiza campos do cabeçalho
          const updated: OrderHeader = {
            ...header,
            cnpj: cliente.cnpj || header.cnpj,
            repCode: cliente.id_vendedor ? String(cliente.id_vendedor) : header.repCode,
            paymentCode: cliente.forma_pagto_codigo
              ? String(cliente.forma_pagto_codigo)
              : header.paymentCode,
            paymentDesc: cliente.forma_pagto_descricao || header.paymentDesc,
            idCliente: cliente.id_cliente,
            idConvenio: cliente.id_convenio,
            clientName: cliente.nome,
            clientFantasia: cliente.fantasia,
          }

          onChange(updated)
          if (onClientFound) {
            onClientFound(cliente)
          }
        } else {
          setSearchStatus('not_found')
          setStatusMessage('CNPJ não encontrado no banco MySQL')
        }
      } catch (err: any) {
        setSearchStatus('error')
        setStatusMessage('Erro ao consultar MySQL')
      } finally {
        setIsSearching(false)
      }
    },
    [header, onChange, onClientFound],
  )

  // Disparo automático quando o CNPJ for preenchido com 14 dígitos
  useEffect(() => {
    const cleanDigits = (header.cnpj || '').replace(/\D/g, '')
    if (cleanDigits.length === 14 && lastSearchedCnpj.current !== header.cnpj) {
      const timer = setTimeout(() => {
        handleBuscarCliente(header.cnpj)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [header.cnpj, handleBuscarCliente])

  return (
    <Card className="shadow-subtle border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-800">
            <Building2 className="w-5 h-5 text-primary" />
            Informações Gerais do Pedido
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-normal gap-1 bg-white border-slate-300"
            >
              <Database className="w-3 h-3 text-emerald-600" />
              Sincronização MySQL externa
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CNPJ do Cliente com busca */}
          <div className="space-y-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="cnpj" className="text-slate-600 font-medium">
                CNPJ do Cliente *
              </Label>
              {header.idCliente && (
                <span className="text-xs text-emerald-600 font-medium">
                  ID: {header.idCliente}{' '}
                  {header.idConvenio ? `(Convênio: ${header.idConvenio})` : ''}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="cnpj"
                  value={header.cnpj}
                  onChange={(e) => handleChange('cnpj', e.target.value)}
                  onBlur={() => {
                    if (header.cnpj && header.cnpj !== lastSearchedCnpj.current) {
                      handleBuscarCliente(header.cnpj)
                    }
                  }}
                  placeholder="00.000.000/0000-00"
                  className="font-medium pr-8"
                />
                {isSearching && (
                  <div className="absolute right-2.5 top-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleBuscarCliente(header.cnpj, true)}
                disabled={isSearching || !header.cnpj}
                title="Consultar cliente no MySQL"
                className="shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 text-slate-600" />
                )}
              </Button>
            </div>

            {/* Status visual de busca */}
            {searchStatus === 'found' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{statusMessage}</span>
              </div>
            )}
            {searchStatus === 'not_found' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {searchStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-md border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{statusMessage}</span>
              </div>
            )}
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
              className={header.repCode ? 'border-slate-300' : 'border-amber-300 bg-amber-50/20'}
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
              className={
                header.paymentCode ? 'border-slate-300' : 'border-amber-300 bg-amber-50/20'
              }
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
