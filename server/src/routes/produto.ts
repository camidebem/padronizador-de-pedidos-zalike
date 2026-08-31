import { Router } from 'express'
import { safeQuery, BreakerOpenError } from '../db'

export const produtoRouter = Router()

interface ProdutoRow {
  produto_codigo: number
  referencia: string | null
  codbarra: string | null
  codigo_no_cliente: string | null
}

/**
 * Fluxo 2 — dado o idCliente (resolvido no Fluxo 1) e um valor digitado
 * pelo usuário (EAN, código interno já usado com esse cliente, ou
 * referência), resolve o código interno do produto. Deve ser chamado uma
 * vez por item do pedido, já que cada linha pode ser um produto diferente.
 */
produtoRouter.get('/produto', async (req, res) => {
  const idClienteRaw = req.query.idCliente
  const valorRaw = req.query.valor
  if (
    typeof idClienteRaw !== 'string' ||
    !idClienteRaw.trim() ||
    typeof valorRaw !== 'string' ||
    !valorRaw.trim()
  ) {
    res.status(400).json({ error: 'Parâmetros "idCliente" e "valor" são obrigatórios.' })
    return
  }
  const idCliente = idClienteRaw.trim()
  const valor = valorRaw.trim()

  try {
    const rows = await safeQuery<ProdutoRow[]>(
      `SELECT t_produto.id AS produto_codigo, t_produto.referencia, t_codbarra.codbarra,
              t_convenio_codigo_no_cliente.codigo_no_cliente
       FROM t_cliente
       INNER JOIN t_codbarra ON (t_codbarra.id_convenio = 0 OR t_codbarra.id_convenio = t_cliente.id_convenio)
       INNER JOIN t_produto ON t_produto.id = t_codbarra.id_produto
       LEFT JOIN t_convenio_codigo_no_cliente ON (
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
      [idCliente, valor, valor, valor],
    )
    const produto = rows[0]
    if (!produto) {
      res.status(404).json({ found: false })
      return
    }

    res.json({ found: true, produtoCodigo: String(produto.produto_codigo) })
  } catch (err) {
    if (err instanceof BreakerOpenError) {
      res.status(503).json({ error: err.message })
      return
    }
    console.error('[GET /produto] erro inesperado:', err)
    res.status(502).json({ error: 'Falha ao consultar o banco externo.' })
  }
})
