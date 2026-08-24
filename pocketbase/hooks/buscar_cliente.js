// pocketbase/hooks/buscar_cliente.js
// Rota: POST /api/custom/buscar-cliente

routerAdd('POST', '/api/custom/buscar-cliente', async (e) => {
  const password = $os.getenv('MYSQL_PASSWORD')
  if (!password) {
    return e.json(400, {
      configured: false,
      error: 'Senha do banco MySQL não configurada.',
    })
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const rawCnpj = (body.cnpj || '').toString().trim()

  if (!rawCnpj) {
    return e.json(400, {
      configured: true,
      error: 'CNPJ do cliente não informado.',
    })
  }

  const mysql = require('mysql2/promise')
  let connection = null

  try {
    connection = await mysql.createConnection({
      host: 'zalikecloud.access.ly',
      port: 6338,
      user: 'pedido_padrao',
      password: password,
      database: 'zalike_ia',
      connectTimeout: 10000,
    })

    // Query 1 — Buscar cliente
    const [clientRows] = await connection.query(
      `SELECT id_cliente, nome, fantasia, cnpj, id_convenio
       FROM t_cliente
       WHERE cnpj = ?`,
      [rawCnpj],
    )

    if (!clientRows || clientRows.length === 0) {
      return e.json(200, {
        configured: true,
        data: null,
        message: 'Cliente não encontrado para o CNPJ informado.',
      })
    }

    const cliente = clientRows[0]
    const idCliente = cliente.id_cliente
    const idConvenio = cliente.id_convenio != null ? cliente.id_convenio : 0

    // Query 2 — Forma de pagamento
    let formaPagtoCodigo = null
    let formaPagtoDescricao = null
    try {
      const [pagtoRows] = await connection.query(
        `SELECT 
            t_formapagto.id AS forma_pagto_codigo,
            t_formapagto.descricao AS forma_pagto_descricao
         FROM t_cliente
         LEFT JOIN t_clientes_formapagto ON t_cliente.id_cliente = t_clientes_formapagto.id_cliente
         LEFT JOIN t_formapagto ON t_formapagto.id = t_clientes_formapagto.id_formpagto
         WHERE t_cliente.id_cliente = ?`,
        [idCliente],
      )

      if (pagtoRows && pagtoRows.length > 0 && pagtoRows[0].forma_pagto_codigo != null) {
        formaPagtoCodigo = pagtoRows[0].forma_pagto_codigo
        formaPagtoDescricao = pagtoRows[0].forma_pagto_descricao
      }
    } catch (errPagto) {
      console.warn('[buscar_cliente] Erro ao buscar forma de pagamento:', errPagto)
    }

    // Query 3 — Representante/vendedor
    let idVendedor = null
    try {
      const [vendedorRows] = await connection.query(
        `SELECT t_vendedor.id_vendedor
         FROM t_cliente
         INNER JOIN t_vendedor ON t_cliente.id_representante = t_vendedor.id_vendedor
         WHERE t_cliente.id_cliente = ?`,
        [idCliente],
      )

      if (vendedorRows && vendedorRows.length > 0 && vendedorRows[0].id_vendedor != null) {
        idVendedor = vendedorRows[0].id_vendedor
      }
    } catch (errVendedor) {
      console.warn('[buscar_cliente] Erro ao buscar vendedor:', errVendedor)
    }

    return e.json(200, {
      configured: true,
      data: {
        id_cliente: cliente.id_cliente,
        nome: cliente.nome,
        fantasia: cliente.fantasia,
        cnpj: cliente.cnpj,
        id_convenio: idConvenio,
        forma_pagto_codigo: formaPagtoCodigo,
        forma_pagto_descricao: formaPagtoDescricao,
        id_vendedor: idVendedor,
      },
    })
  } catch (err) {
    console.error('[buscar_cliente] Erro na conexão ou consulta MySQL:', err)
    const errMessage = err && err.message ? err.message : String(err)
    return e.json(500, {
      configured: true,
      error: `Erro ao conectar ao banco de dados MySQL: ${errMessage}`,
    })
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch (closeErr) {
        console.warn('[buscar_cliente] Erro ao fechar conexão MySQL:', closeErr)
      }
    }
  }
})
