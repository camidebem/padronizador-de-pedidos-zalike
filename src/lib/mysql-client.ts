/**
 * Interface and client service for MySQL Lookup
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
  data: T | null
  configured?: boolean
  error?: string
}

// Em ambiente de desenvolvimento ou produção Skip Cloud, podemos chamar a função edge ou fallback
export async function apiBuscarClientePorCNPJ(
  cnpj: string,
): Promise<{ cliente: ClienteMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const clean = (cnpj || '').trim()
    if (!clean) return { cliente: null, configured: true }

    // Chamada para a server function / edge function
    const res = await fetch('/api/mysql-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'buscarClientePorCNPJ',
        cnpj: clean,
      }),
    })

    if (!res.ok) {
      // Fallback ou erro
      const errJson = await res.json().catch(() => ({}))
      return {
        cliente: null,
        configured: errJson.configured ?? true,
        error: errJson.error || `Erro ${res.status} ao consultar MySQL`,
      }
    }

    const json = await res.json()
    return {
      cliente: json.data || json.cliente || null,
      configured: json.configured !== false,
      error: json.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar cliente por CNPJ:', err)
    return {
      cliente: null,
      configured: true,
      error: err?.message || 'Falha na conexão com o servidor de dados',
    }
  }
}

export async function apiBuscarProdutoPorCodigo(
  idCliente: number | string,
  valorInformado: string,
): Promise<{ produto: ProdutoMySQLResult | null; configured: boolean; error?: string }> {
  try {
    const val = (valorInformado || '').trim()
    if (!idCliente || !val) return { produto: null, configured: true }

    const res = await fetch('/api/mysql-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'buscarProdutoPorCodigo',
        id_cliente: idCliente,
        valor: val,
      }),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      return {
        produto: null,
        configured: errJson.configured ?? true,
        error: errJson.error || `Erro ${res.status} ao consultar MySQL`,
      }
    }

    const json = await res.json()
    return {
      produto: json.data || json.produto || null,
      configured: json.configured !== false,
      error: json.error,
    }
  } catch (err: any) {
    console.error('Erro ao buscar produto por código:', err)
    return {
      produto: null,
      configured: true,
      error: err?.message || 'Falha na conexão com o servidor de dados',
    }
  }
}
