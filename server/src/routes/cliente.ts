import { Router } from 'express'
import { safeQuery, BreakerOpenError } from '../db'

export const clienteRouter = Router()

interface ClienteRow {
  id_cliente: number
  nome: string
  fantasia: string
  cnpj: string
  id_convenio: number | null
}

interface FormaPagtoRow {
  forma_pagto_codigo: number | null
  forma_pagto_descricao: string | null
}

interface VendedorRow {
  id_vendedor: number
}

/**
 * Fluxo 1 — dado o CNPJ do cliente, resolve o cliente e preenche
 * automaticamente forma de pagamento padrão e código do representante.
 * Devolve também idCliente, necessário para as buscas de item (Fluxo 2).
 */
clienteRouter.get('/cliente', async (req, res) => {
  const cnpjRaw = req.query.cnpj
  if (typeof cnpjRaw !== 'string' || !cnpjRaw.trim()) {
    res.status(400).json({ error: 'Parâmetro "cnpj" é obrigatório.' })
    return
  }
  const cnpj = cnpjRaw.trim()

  try {
    const clientes = await safeQuery<ClienteRow[]>(
      'SELECT id_cliente, nome, fantasia, cnpj, id_convenio FROM t_cliente WHERE cnpj = ?',
      [cnpj],
    )
    const cliente = clientes[0]
    if (!cliente) {
      res.status(404).json({ found: false })
      return
    }

    const [formaPagtoRows, vendedorRows] = await Promise.all([
      safeQuery<FormaPagtoRow[]>(
        `SELECT t_formapagto.id AS forma_pagto_codigo, t_formapagto.descricao AS forma_pagto_descricao
         FROM t_cliente
         LEFT JOIN t_clientes_formapagto ON t_cliente.id_cliente = t_clientes_formapagto.id_cliente
         LEFT JOIN t_formapagto ON t_formapagto.id = t_clientes_formapagto.id_formpagto
         WHERE t_cliente.id_cliente = ?`,
        [cliente.id_cliente],
      ),
      safeQuery<VendedorRow[]>(
        `SELECT t_vendedor.id_vendedor
         FROM t_cliente
         INNER JOIN t_vendedor ON t_cliente.id_representante = t_vendedor.id_vendedor
         WHERE t_cliente.id_cliente = ?`,
        [cliente.id_cliente],
      ),
    ])

    const formaPagto = formaPagtoRows[0]
    const vendedor = vendedorRows[0]

    res.json({
      found: true,
      idCliente: String(cliente.id_cliente),
      idConvenio: cliente.id_convenio != null ? String(cliente.id_convenio) : null,
      formaPagtoCodigo:
        formaPagto?.forma_pagto_codigo != null ? String(formaPagto.forma_pagto_codigo) : '',
      formaPagtoDescricao: formaPagto?.forma_pagto_descricao ?? '',
      repCode: vendedor?.id_vendedor != null ? String(vendedor.id_vendedor) : '',
    })
  } catch (err) {
    if (err instanceof BreakerOpenError) {
      res.status(503).json({ error: err.message })
      return
    }
    console.error('[GET /cliente] erro inesperado:', err)
    res.status(502).json({ error: 'Falha ao consultar o banco externo.' })
  }
})
