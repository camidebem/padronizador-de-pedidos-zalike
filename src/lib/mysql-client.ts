import { OrderHeader, OrderItem } from '@/hooks/use-order'

/**
 * Cliente frontend para a Supabase Edge Function 'mysql-lookup'.
 * Executa chamadas seguras para consulta no banco MySQL externo (zalike_ia)
 * sem expor credenciais do banco no navegador.
 *
 * Degrada graciosamente retornando null em caso de erro de rede, timeout
 * ou não-configuração, sem quebrar a UI.
 *
 * NUNCA executa retries automáticos em loop — o firewall do MySQL bloqueia o
 * IP após 5 tentativas com credenciais erradas. Uma tentativa por ação com timeout.
 */

export interface ClienteLookupData {
  id_cliente: string
  nome: string
  fantasia: string
  cnpj: string
  id_convenio: string | null
  forma_pagto_codigo: string
  forma_pagto_descricao: string
  id_vendedor: string
}

export interface ProdutoLookupData {
  produto_codigo: string
  referencia: string | null
  codbarra: string | null
  codigo_no_cliente: string | null
}

interface EdgeFunctionResponse<T> {
  configured?: boolean
  data?: T | null
  error?: string
  detail?: string
}

const DEFAULT_TIMEOUT_MS = 10000

function getSupabaseConfig(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  return { url: url.replace(/\/+$/, ''), key }
}

async function callEdgeFunction<T>(payload: Record<string, unknown>): Promise<T | null> {
  const config = getSupabaseConfig()
  if (!config) {
    console.warn(
      '[mysql-client] Supabase URL ou Anon Key não configurados. Degradação para preenchimento manual.',
    )
    return null
  }

  const endpoint = `${config.url}/functions/v1/mysql-lookup`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(
        `[mysql-client] Edge Function respondeu HTTP ${response.status}: ${response.statusText}`,
      )
      return null
    }

    const json = (await response.json()) as EdgeFunctionResponse<T>
    if (json.configured === false) {
      console.warn(
        '[mysql-client] Edge Function não configurada (MYSQL_PASSWORD ausente).',
        json.error,
      )
      return null
    }

    return json.data ?? null
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[mysql-client] Timeout ao consultar Edge Function (10s excedidos).')
    } else {
      console.warn('[mysql-client] Erro de rede ou consulta na Edge Function:', error)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Busca dados do cliente a partir do CNPJ
 */
export async function buscarClientePorCNPJ(cnpj: string): Promise<ClienteLookupData | null> {
  const cleanCnpj = cnpj.trim()
  if (!cleanCnpj) return null

  return callEdgeFunction<ClienteLookupData>({
    action: 'buscarClientePorCNPJ',
    cnpj: cleanCnpj,
  })
}

/**
 * Busca dados do produto a partir de idCliente e valor (EAN, código cliente ou referência)
 */
export async function buscarProdutoPorCodigo(
  idCliente: string | number,
  valor: string,
): Promise<ProdutoLookupData | null> {
  const cleanValor = valor.trim()
  if (!idCliente || !cleanValor) return null

  return callEdgeFunction<ProdutoLookupData>({
    action: 'buscarProdutoPorCodigo',
    idCliente,
    valor: cleanValor,
  })
}

/**
 * Fluxo 1: A partir do CNPJ do cabeçalho, busca cliente/forma de pagamento/representante
 * e devolve cabeçalho enriquecido sem sobrescrever valores já preenchidos pelo usuário.
 */
export async function enrichHeaderFromCnpj(header: OrderHeader): Promise<OrderHeader> {
  if (!header.cnpj.trim()) return header

  const cliente = await buscarClientePorCNPJ(header.cnpj)
  if (!cliente) return header

  return {
    ...header,
    idCliente: cliente.id_cliente,
    idConvenio: cliente.id_convenio,
    repCode: header.repCode.trim() ? header.repCode : cliente.id_vendedor,
    paymentCode: header.paymentCode.trim() ? header.paymentCode : cliente.forma_pagto_codigo,
    paymentDesc: header.paymentDesc.trim() ? header.paymentDesc : cliente.forma_pagto_descricao,
  }
}

/**
 * Fluxo 2: Executa busca de produto para cada item que ainda não possui Código Interno.
 * Não realiza retries em loop.
 */
export async function enrichItemsWithIdCliente(
  items: OrderItem[],
  idCliente: string | null | undefined,
): Promise<OrderItem[]> {
  if (!idCliente) return items

  return Promise.all(
    items.map(async (item) => {
      if (item.itemCode && item.itemCode.trim()) return item

      const valor = item.barcode.trim() || item.reference.trim()
      if (!valor) return item

      const prod = await buscarProdutoPorCodigo(idCliente, valor)
      if (!prod) return item

      return { ...item, itemCode: prod.produto_codigo }
    }),
  )
}
