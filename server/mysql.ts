import mysql, { Pool } from 'mysql2/promise'

const MYSQL_HOST = process.env.MYSQL_HOST || 'zalikecloud.access.ly'
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '6338', 10)
const MYSQL_USER = process.env.MYSQL_USER || 'pedido_padrao'
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'zalike_ia'

let pool: Pool | null = null

function getPool(): Pool | null {
  const password = process.env.MYSQL_PASSWORD
  if (!password) {
    console.warn('[MySQL] MYSQL_PASSWORD não configurada no ambiente.')
    return null
  }

  if (!pool) {
    pool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: password,
      database: MYSQL_DATABASE,
      connectTimeout: 10000, // 10 segundos de timeout
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    })
  }
  return pool
}

export interface ClienteResult {
  id_cliente: number
  nome: string
  fantasia: string
  cnpj: string
  id_convenio: number
  forma_pagto_codigo: string | null
  forma_pagto_descricao: string | null
  id_vendedor: string | null
}

export interface ProdutoResult {
  produto_codigo: string
  referencia: string | null
  codbarra: string | null
  codigo_no_cliente: string | null
}

/**
 * Normaliza CNPJ removendo pontuação
 */
export function sanitizeCNPJ(cnpj: string): string {
  return cnpj ? cnpj.replace(/\D/g, '') : ''
}

/**
 * Fluxo 1: Busca cliente pelo CNPJ (tenta tanto o formato limpo quanto o formatado original se necessário)
 */
export async function buscarClientePorCNPJ(cnpjInput: string): Promise<ClienteResult | null> {
  const password = process.env.MYSQL_PASSWORD
  if (!password) {
    console.warn('[MySQL] MYSQL_PASSWORD não definida. Impossível conectar ao MySQL.')
    return null
  }

  const rawCnpj = cnpjInput?.trim()
  if (!rawCnpj) return null

  const cleanCnpj = sanitizeCNPJ(rawCnpj)
  const currentPool = getPool()
  if (!currentPool) return null

  try {
    // 1. Busca o cliente e seu convênio
    // Busca pelo CNPJ exato ou limpo
    const [clientRows] = await currentPool.query<any[]>(
      `SELECT id_cliente, nome, fantasia, cnpj, id_convenio
       FROM t_cliente
       WHERE cnpj = ? OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
       LIMIT 1`,
      [rawCnpj, cleanCnpj],
    )

    if (!clientRows || clientRows.length === 0) {
      console.log(`[MySQL] Cliente não encontrado para o CNPJ: ${rawCnpj}`)
      return null
    }

    const cliente = clientRows[0]
    const idCliente = cliente.id_cliente
    const idConvenio = cliente.id_convenio ?? 0

    // 2. Busca forma de pagamento padrão
    let formaPagtoCodigo: string | null = null
    let formaPagtoDescricao: string | null = null

    try {
      const [pagtoRows] = await currentPool.query<any[]>(
        `SELECT 
            t_formapagto.id AS forma_pagto_codigo,
            t_formapagto.descricao AS forma_pagto_descricao
         FROM t_cliente
         LEFT JOIN t_clientes_formapagto ON t_cliente.id_cliente = t_clientes_formapagto.id_cliente
         LEFT JOIN t_formapagto ON t_formapagto.id = t_clientes_formapagto.id_formpagto
         WHERE t_cliente.id_cliente = ?
         LIMIT 1`,
        [idCliente],
      )

      if (pagtoRows && pagtoRows.length > 0 && pagtoRows[0].forma_pagto_codigo) {
        formaPagtoCodigo = String(pagtoRows[0].forma_pagto_codigo)
        formaPagtoDescricao = pagtoRows[0].forma_pagto_descricao || ''
      }
    } catch (err) {
      console.error('[MySQL] Erro ao buscar forma de pagamento para id_cliente:', idCliente, err)
    }

    // 3. Busca o código do representante/vendedor
    let idVendedor: string | null = null
    try {
      const [vendedorRows] = await currentPool.query<any[]>(
        `SELECT t_vendedor.id_vendedor
         FROM t_cliente
         INNER JOIN t_vendedor ON t_cliente.id_representante = t_vendedor.id_vendedor
         WHERE t_cliente.id_cliente = ?
         LIMIT 1`,
        [idCliente],
      )

      if (vendedorRows && vendedorRows.length > 0 && vendedorRows[0].id_vendedor) {
        idVendedor = String(vendedorRows[0].id_vendedor)
      }
    } catch (err) {
      console.error('[MySQL] Erro ao buscar vendedor para id_cliente:', idCliente, err)
    }

    return {
      id_cliente: idCliente,
      nome: cliente.nome || '',
      fantasia: cliente.fantasia || '',
      cnpj: cliente.cnpj || rawCnpj,
      id_convenio: idConvenio,
      forma_pagto_codigo: formaPagtoCodigo,
      forma_pagto_descricao: formaPagtoDescricao,
      id_vendedor: idVendedor,
    }
  } catch (error) {
    console.error('[MySQL] Erro na consulta buscarClientePorCNPJ:', error)
    return null
  }
}

/**
 * Fluxo 2: Busca produto por código/EAN/referência/código no cliente
 */
export async function buscarProdutoPorCodigo(
  idCliente: number | string,
  valorInformado: string,
): Promise<ProdutoResult | null> {
  const password = process.env.MYSQL_PASSWORD
  if (!password) {
    console.warn('[MySQL] MYSQL_PASSWORD não definida. Impossível conectar ao MySQL.')
    return null
  }

  const val = valorInformado?.trim()
  if (!val || !idCliente) return null

  const currentPool = getPool()
  if (!currentPool) return null

  try {
    const [rows] = await currentPool.query<any[]>(
      `SELECT
          t_produto.id AS produto_codigo,
          t_produto.referencia,
          t_codbarra.codbarra,
          t_convenio_codigo_no_cliente.codigo_no_cliente
       FROM t_cliente
       INNER JOIN t_codbarra
          ON (t_codbarra.id_convenio = 0
              OR t_codbarra.id_convenio = t_cliente.id_convenio)
       INNER JOIN t_produto
          ON t_produto.id = t_codbarra.id_produto
       LEFT JOIN t_convenio_codigo_no_cliente
          ON (
              t_convenio_codigo_no_cliente.id_produto = t_produto.id
              AND t_convenio_codigo_no_cliente.id_convenio = t_cliente.id_convenio
          )
       WHERE t_cliente.id_cliente = ?
         AND (
              t_codbarra.codbarra = ?
              OR t_convenio_codigo_no_cliente.codigo_no_cliente = ?
              OR t_produto.referencia = ?
            )
       LIMIT 1`,
      [idCliente, val, val, val],
    )

    if (!rows || rows.length === 0) {
      return null
    }

    const item = rows[0]
    return {
      produto_codigo: String(item.produto_codigo),
      referencia: item.referencia ? String(item.referencia) : null,
      codbarra: item.codbarra ? String(item.codbarra) : null,
      codigo_no_cliente: item.codigo_no_cliente ? String(item.codigo_no_cliente) : null,
    }
  } catch (error) {
    console.error(
      `[MySQL] Erro na consulta buscarProdutoPorCodigo para cliente ${idCliente} e valor ${val}:`,
      error,
    )
    return null
  }
}
