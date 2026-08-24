// pocketbase/hooks/buscar_produto.js
// Rota: POST /api/custom/buscar-produto

routerAdd('POST', '/api/custom/buscar-produto', async (e) => {
  const password = $os.getenv('MYSQL_PASSWORD')
  if (!password) {
    return e.json(400, {
      configured: false,
      error: 'Senha do banco MySQL não configurada.',
    })
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const idCliente = body.id_cliente
  const rawValor =
    body.valor_informado !== undefined && body.valor_informado !== null
      ? String(body.valor_informado).trim()
      : body.valor !== undefined && body.valor !== null
        ? String(body.valor).trim()
        : ''

  if (!idCliente || !rawValor) {
    return e.json(400, {
      configured: true,
      error: 'id_cliente e valor_informado são obrigatórios.',
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

    const [rows] = await connection.query(
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
            )`,
      [idCliente, rawValor, rawValor, rawValor],
    )

    if (!rows || rows.length === 0) {
      return e.json(200, {
        configured: true,
        data: null,
        message: 'Produto não encontrado.',
      })
    }

    const prod = rows[0]

    return e.json(200, {
      configured: true,
      data: {
        produto_codigo:
          prod.produto_codigo != null ? String(prod.produto_codigo) : prod.produto_codigo,
        referencia: prod.referencia != null ? String(prod.referencia) : null,
        codbarra: prod.codbarra != null ? String(prod.codbarra) : null,
        codigo_no_cliente: prod.codigo_no_cliente != null ? String(prod.codigo_no_cliente) : null,
      },
    })
  } catch (err) {
    console.error('[buscar_produto] Erro na conexão ou consulta MySQL:', err)
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
        console.warn('[buscar_produto] Erro ao fechar conexão MySQL:', closeErr)
      }
    }
  }
})
