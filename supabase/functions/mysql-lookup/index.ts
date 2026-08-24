import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Client } from 'https://deno.land/x/mysql@v2.12.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MYSQL_HOST = Deno.env.get('MYSQL_HOST') || 'zalikecloud.access.ly'
const MYSQL_PORT = parseInt(Deno.env.get('MYSQL_PORT') || '6338', 10)
const MYSQL_USER = Deno.env.get('MYSQL_USER') || 'pedido_padrao'
const MYSQL_DATABASE = Deno.env.get('MYSQL_DATABASE') || 'zalike_ia'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const password = Deno.env.get('MYSQL_PASSWORD')
    if (!password) {
      return new Response(
        JSON.stringify({
          configured: false,
          error: 'MYSQL_PASSWORD não configurada como segredo no ambiente.',
          data: null,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    const body = await req.json()
    const { action, cnpj, id_cliente, valor } = body

    // Create client with strict timeout and single attempt (no retry loop)
    const client = await new Client().connect({
      hostname: MYSQL_HOST,
      port: MYSQL_PORT,
      username: MYSQL_USER,
      password: password,
      db: MYSQL_DATABASE,
      timeout: 10000,
    })

    try {
      if (action === 'buscarClientePorCNPJ') {
        const rawCnpj = (cnpj || '').trim()
        const cleanCnpj = rawCnpj.replace(/\D/g, '')

        if (!rawCnpj) {
          return new Response(JSON.stringify({ error: 'CNPJ obrigatório', data: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }

        // 1. Busca o cliente e seu convênio
        const clientRows = await client.query(
          `SELECT id_cliente, nome, fantasia, cnpj, id_convenio
           FROM t_cliente
           WHERE cnpj = ? OR REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = ?
           LIMIT 1`,
          [rawCnpj, cleanCnpj],
        )

        if (!clientRows || clientRows.length === 0) {
          return new Response(JSON.stringify({ configured: true, data: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }

        const cliente = clientRows[0]
        const idCliente = cliente.id_cliente
        const idConvenio = cliente.id_convenio ?? 0

        // 2. Busca forma de pagamento padrão
        let formaPagtoCodigo: string | null = null
        let formaPagtoDescricao: string | null = null

        try {
          const pagtoRows = await client.query(
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
          console.error('[MySQL Deno] Erro ao buscar forma de pagamento:', err)
        }

        // 3. Busca o código do representante/vendedor
        let idVendedor: string | null = null
        try {
          const vendedorRows = await client.query(
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
          console.error('[MySQL Deno] Erro ao buscar vendedor:', err)
        }

        return new Response(
          JSON.stringify({
            configured: true,
            data: {
              id_cliente: idCliente,
              nome: cliente.nome || '',
              fantasia: cliente.fantasia || '',
              cnpj: cliente.cnpj || rawCnpj,
              id_convenio: idConvenio,
              forma_pagto_codigo: formaPagtoCodigo,
              forma_pagto_descricao: formaPagtoDescricao,
              id_vendedor: idVendedor,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }

      if (action === 'buscarProdutoPorCodigo') {
        const idCli = id_cliente
        const val = (valor || '').trim()

        if (!idCli || !val) {
          return new Response(
            JSON.stringify({ error: 'id_cliente e valor são obrigatórios', data: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
          )
        }

        const prodRows = await client.query(
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
          [idCli, val, val, val],
        )

        if (!prodRows || prodRows.length === 0) {
          return new Response(JSON.stringify({ configured: true, data: null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }

        const item = prodRows[0]
        return new Response(
          JSON.stringify({
            configured: true,
            data: {
              produto_codigo: String(item.produto_codigo),
              referencia: item.referencia ? String(item.referencia) : null,
              codbarra: item.codbarra ? String(item.codbarra) : null,
              codigo_no_cliente: item.codigo_no_cliente ? String(item.codigo_no_cliente) : null,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }

      return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    } finally {
      await client.close()
    }
  } catch (error: any) {
    console.error('[MySQL Deno Server] Erro:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao comunicar com MySQL', data: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
