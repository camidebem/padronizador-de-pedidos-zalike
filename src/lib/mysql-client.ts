/**
 * Interface and client service for MySQL Lookup via PocketBase SDK
 */
import pb from '@/lib/pocketbase/client'

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
    err?.message?.includes('Failed to fetch')
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
 * Fluxo 1: Chama a server function buscarClientePorCNPJ via PocketBase SDK
 * pb.send('/api/custom/buscar-cliente', { method: 'POST', body: { cnpj: valor } })
 */
export async function apiBuscarClientePorCNPJ(
  cnpj: string,
): Promise<{ cliente: ClienteMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const clean = (cnpj || '').trim()
    if (!clean) return { cliente: null, configured: true }

    const res = await pb.send<LookupResponse<ClienteMySQLResult>>('/api/custom/buscar-cliente', {
      method: 'POST',
      body: {
        cnpj: clean,
      },
    })

    if (res?.configured === false) {
      return {
        cliente: null,
        configured: false,
        error:
          res.error ||
          'A senha do banco MySQL (MYSQL_PASSWORD) não está configurada. Configure a variável no painel do servidor.',
      }
    }

    const cliente = res?.data || res?.cliente || null

    return {
      cliente,
      configured: true,
      error: res?.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar cliente por CNPJ via PocketBase:', err)
    const { errorMsg, configured } = parseErrorMessage(err)
    return {
      cliente: null,
      configured,
      error: errorMsg,
    }
  }
}

/**
 * Fluxo 2: Chama a server function buscarProdutoPorCodigo via PocketBase SDK
 * pb.send('/api/custom/buscar-produto', { method: 'POST', body: { id_cliente, valor_informado } })
 */
export async function apiBuscarProdutoPorCodigo(
  idCliente: number | string,
  valorInformado: string,
): Promise<{ produto: ProdutoMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const val = (valorInformado || '').trim()
    if (!idCliente || !val) return { produto: null, configured: true }

    const res = await pb.send<LookupResponse<ProdutoMySQLResult>>('/api/custom/buscar-produto', {
      method: 'POST',
      body: {
        id_cliente: idCliente,
        valor_informado: val,
        // Também envia chave alternativa caso o hook leia 'valor'
        valor: val,
      },
    })

    if (res?.configured === false) {
      return {
        produto: null,
        configured: false,
        error:
          res.error ||
          'A senha do banco MySQL (MYSQL_PASSWORD) não está configurada. Configure a variável no painel do servidor.',
      }
    }

    const produto = res?.data || res?.produto || null

    return {
      produto,
      configured: true,
      error: res?.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar produto por código via PocketBase:', err)
    const { errorMsg, configured } = parseErrorMessage(err)
    return {
      produto: null,
      configured,
      error: errorMsg,
    }
  }
}
