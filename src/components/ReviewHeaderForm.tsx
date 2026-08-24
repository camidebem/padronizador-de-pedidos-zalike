import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { OrderHeader } from '@/hooks/use-order'
import {
  Building2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Info,
} from 'lucide-react'
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

      // Se for vazio ou muito curto para busca automática
      if (!force && cleanDigits.length < 11 && raw.length < 11) {
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
          setStatusMessage(
            error ||
              'MYSQL_PASSWORD não configurada no servidor Skip Cloud. Configure a variável de ambiente.',
          )
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

          // Atualiza campos do cabeçalho automaticamente conforme requisito:
          // - "Código forma de pagamento" com forma_pagto_codigo
          // - "Descrição forma de pagamento" com forma_pagto_descricao
          // - "Código do representante" com id_vendedor
          // - Guardar id_convenio e id_cliente no estado para uso no Fluxo 2
          const updated: OrderHeader = {
            ...header,
            cnpj: cliente.cnpj || header.cnpj,
            repCode:
              cliente.id_vendedor !== null && cliente.id_vendedor !== undefined
                ? String(cliente.id_vendedor)
                : header.repCode,
            paymentCode:
              cliente.forma_pagto_codigo !== null && cliente.forma_pagto_codigo !== undefined
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
          setStatusMessage('Cliente não encontrado para o CNPJ informado no banco de dados.')
        }
      } catch (err: any) {
        setSearchStatus('error')
        setStatusMessage(err?.message || 'Erro ao consultar cliente no MySQL.')
      } finally {
        setIsSearching(false)
      }
    },
    [header, onChange, onClientFound],
  )

  // Debounce de 500ms no campo CNPJ ao digitar
  useEffect(() => {
    const raw = (header.cnpj || '').trim()
    const cleanDigits = raw.replace(/\D/g, '')

    // Se tiver pelo menos dígitos suficientes ou CNPJ formatado, dispara debounce de 500ms
    if (cleanDigits.length >= 11 && lastSearchedCnpj.current !== raw) {
      const timer = setTimeout(() => {
        handleBuscarCliente(raw)
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs font-normal gap-1 bg-white border-slate-300 cursor-help"
                  >
                    <Database className="w-3 h-3 text-emerald-600" />
                    Sincronização MySQL externa
                    <Info className="w-3 h-3 text-slate-400 ml-0.5" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Os dados do banco são sincronizados 1x/dia (entre 07h e 08h). Pode haver defasagem
                  de até 24h.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CNPJ do Cliente com busca e indicador visual */}
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
                <div className="absolute right-2.5 top-2.5 flex items-center pointer-events-none">
                  {isSearching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {!isSearching && searchStatus === 'found' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  {!isSearching && searchStatus === 'not_found' && (
                    <XCircle className="w-4 h-4 text-amber-500" />
                  )}
                  {!isSearching && searchStatus === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                </div>
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

            {/* Aviso de defasagem de dados discreto */}
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                Os dados do banco são sincronizados 1x/dia (entre 07h e 08h). Pode haver defasagem
                de até 24h.
              </span>
            </p>

            {/* Status visual de busca */}
            {searchStatus === 'found' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{statusMessage}</span>
              </div>
            )}
            {searchStatus === 'not_found' && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {searchStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-md border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">{statusMessage}</span>
              </div>
            )}
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
