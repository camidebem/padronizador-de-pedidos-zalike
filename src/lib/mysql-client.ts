/**
 * Interface and client service for MySQL Lookup via Supabase Edge Function
 */

export interface ClienteMySQLResult {
  id_cliente: number
  nome: string
  fantasia: string
  cnpj: string
  id_convenio: number
  forma_pagto_codigo: string | null
  forma_pagto_descricao: string | null
  id_vendedor: string | null
}

export interface ProdutoMySQLResult {
  produto_codigo: string
  referencia: string | null
  codbarra: string | null
  codigo_no_cliente: string | null
}

export interface LookupResponse<T> {
  data?: T | null
  cliente?: T | null
  produto?: T | null
  configured?: boolean
  error?: string
  message?: string
}

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url) {
    return null
  }

  return {
    url: url.replace(/\/+$/, ''),
    anonKey: anonKey || '',
  }
}

/**
 * Normaliza erros retornando mensagens amigáveis em português
 */
function parseErrorMessage(err: any): { errorMsg: string; configured: boolean } {
  const data = err?.data || err?.response?.data || {}
  const status = err?.status || err?.response?.status || 0

  if (data?.configured === false || err?.message?.includes('MYSQL_PASSWORD')) {
    return {
      configured: false,
      errorMsg:
        data.error ||
        'A senha do banco MySQL (MYSQL_PASSWORD) não está configurada no servidor. Por favor, configure a variável de ambiente.',
    }
  }

  if (data?.error) {
    return {
      configured: data.configured !== false,
      errorMsg: data.error,
    }
  }

  if (
    status === 0 ||
    err?.name === 'ClientResponseError 0' ||
    err?.name === 'TypeError' ||
    err?.message?.includes('Failed to fetch') ||
    err?.message?.includes('NetworkError')
  ) {
    return {
      configured: true,
      errorMsg: 'Falha na conexão com o servidor. Verifique sua conexão com a internet.',
    }
  }

  if (status === 504 || status === 408 || err?.message?.toLowerCase().includes('timeout')) {
    return {
      configured: true,
      errorMsg:
        'Tempo limite esgotado ao tentar conectar ao banco MySQL. Tente novamente em instantes.',
    }
  }

  return {
    configured: true,
    errorMsg: err?.message || 'Erro inesperado ao consultar os dados no servidor.',
  }
}

/**
 * Executa requisição para a Edge Function Supabase (mysql-lookup)
 */
async function callMysqlLookup<T>(payload: Record<string, any>): Promise<LookupResponse<T>> {
  const config = getSupabaseConfig()
  if (!config) {
    return {
      configured: false,
      error:
        'A URL da API Supabase (VITE_SUPABASE_URL) não está configurada no ambiente da aplicação.',
      data: null,
    }
  }

  const endpoint = `${config.url}/functions/v1/mysql-lookup`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.anonKey) {
    headers['Authorization'] = `Bearer ${config.anonKey}`
    headers['apikey'] = config.anonKey
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  let json: any = null
  try {
    json = await res.json()
  } catch {
    throw new Error(`Resposta inválida do servidor (HTTP ${res.status}).`)
  }

  if (!res.ok) {
    if (json?.configured === false) {
      return json
    }
    const errObj: any = new Error(json?.error || `Erro HTTP ${res.status} ao consultar MySQL`)
    errObj.status = res.status
    errObj.data = json
    throw errObj
  }

  return json
}

/**
 * Fluxo 1: Chama a Edge Function buscarClientePorCNPJ
 */
export async function apiBuscarClientePorCNPJ(
  cnpj: string,
): Promise<{ cliente: ClienteMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const clean = (cnpj || '').trim()
    if (!clean) return { cliente: null, configured: true }

    const res = await callMysqlLookup<ClienteMySQLResult>({
      action: 'buscarClientePorCNPJ',
      cnpj: clean,
    })

    if (res?.configured === false) {
      return {
        cliente: null,
        configured: false,
        error:
          res.error ||
          'A senha do banco MySQL (MYSQL_PASSWORD) não está configurada. Configure o segredo na Edge Function.',
      }
    }

    const cliente = res?.data || res?.cliente || null

    return {
      cliente,
      configured: true,
      error: res?.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar cliente por CNPJ via Supabase Function:', err)
    const { errorMsg, configured } = parseErrorMessage(err)
    return {
      cliente: null,
      configured,
      error: errorMsg,
    }
  }
}

/**
 * Fluxo 2: Chama a Edge Function buscarProdutoPorCodigo
 */
export async function apiBuscarProdutoPorCodigo(
  idCliente: number | string,
  valorInformado: string,
): Promise<{ produto: ProdutoMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const val = (valorInformado || '').trim()
    if (!idCliente || !val) return { produto: null, configured: true }

    const res = await callMysqlLookup<ProdutoMySQLResult>({
      action: 'buscarProdutoPorCodigo',
      id_cliente: typeof idCliente === 'string' ? parseInt(idCliente, 10) || idCliente : idCliente,
      valor: val,
    })

    if (res?.configured === false) {
      return {
        produto: null,
        configured: false,
        error:
          res.error ||
          'A senha do banco MySQL (MYSQL_PASSWORD) não está configurada. Configure o segredo na Edge Function.',
      }
    }

    const produto = res?.data || res?.produto || null

    return {
      produto,
      configured: true,
      error: res?.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar produto por código via Supabase Function:', err)
    const { errorMsg, configured } = parseErrorMessage(err)
    return {
      produto: null,
      configured,
      error: errorMsg,
    }
  }
}
