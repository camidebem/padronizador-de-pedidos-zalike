// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code is designed to run in Supabase Edge Functions (Deno runtime).

import { Client } from 'https://deno.land/x/mysql@v2.12.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestPayload {
  action: 'buscarClientePorCNPJ' | 'buscarProdutoPorCodigo'
  cnpj?: string
  idCliente?: string | number
  valor?: string
}

Deno.serve(async (req) => {
  // Trata preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const mysqlPassword = Deno.env.get('MYSQL_PASSWORD')
  if (!mysqlPassword) {
    return new Response(
      JSON.stringify({
        configured: false,
        error: 'MYSQL_PASSWORD não configurada no Supabase.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  let body: RequestPayload
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Corpo da requisição inválido (JSON esperado)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const client = new Client()

  try {
    await client.connect({
      hostname: 'zalikecloud.access.ly',
      port: 6338,
      db: 'zalike_ia',
      username: 'pedido_padrao',
      password: mysqlPassword,
      timeout: 8000,
    })

    if (body.action === 'buscarClientePorCNPJ') {
      const cnpj = (body.cnpj || '').trim()
      if (!cnpj) {
        return new Response(JSON.stringify({ error: 'CNPJ obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // 1. Busca dados básicos do cliente
      const clienteResult = await client.query(
        'SELECT id_cliente, nome, fantasia, cnpj, id_convenio, id_representante FROM t_cliente WHERE cnpj = ? LIMIT 1',
        [cnpj],
      )

      if (!clienteResult || clienteResult.length === 0) {
        return new Response(JSON.stringify({ configured: true, data: null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const cliente = clienteResult[0]

      // 2. Busca forma de pagamento
      let formaPagtoCodigo = ''
      let formaPagtoDescricao = ''
      try {
        const fpResult = await client.query(
          `SELECT t_formapagto.id AS forma_pagto_codigo, t_formapagto.descricao AS forma_pagto_descricao
           FROM t_cliente
           LEFT JOIN t_clientes_formapagto ON t_cliente.id_cliente = t_clientes_formapagto.id_cliente
           LEFT JOIN t_formapagto ON t_formapagto.id = t_clientes_formapagto.id_formpagto
           WHERE t_cliente.id_cliente = ?
           LIMIT 1`,
          [cliente.id_cliente],
        )
        if (fpResult && fpResult.length > 0 && fpResult[0].forma_pagto_codigo != null) {
          formaPagtoCodigo = String(fpResult[0].forma_pagto_codigo)
          formaPagtoDescricao = fpResult[0].forma_pagto_descricao ?? ''
        }
      } catch (fpError) {
        console.warn('Erro ao buscar forma de pagamento:', fpError)
      }

      // 3. Busca representante
      let idVendedor = ''
      try {
        const repResult = await client.query(
          `SELECT t_vendedor.id_vendedor
           FROM t_cliente
           INNER JOIN t_vendedor ON t_cliente.id_representante = t_vendedor.id_vendedor
           WHERE t_cliente.id_cliente = ?
           LIMIT 1`,
          [cliente.id_cliente],
        )
        if (repResult && repResult.length > 0 && repResult[0].id_vendedor != null) {
          idVendedor = String(repResult[0].id_vendedor)
        }
      } catch (repError) {
        console.warn('Erro ao buscar vendedor:', repError)
      }

      return new Response(
        JSON.stringify({
          configured: true,
          data: {
            id_cliente: String(cliente.id_cliente),
            nome: cliente.nome ?? '',
            fantasia: cliente.fantasia ?? '',
            cnpj: cliente.cnpj ?? '',
            id_convenio: cliente.id_convenio != null ? String(cliente.id_convenio) : null,
            forma_pagto_codigo: formaPagtoCodigo,
            forma_pagto_descricao: formaPagtoDescricao,
            id_vendedor: idVendedor,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (body.action === 'buscarProdutoPorCodigo') {
      const idCliente = body.idCliente
      const valor = (body.valor || '').trim()

      if (!idCliente || !valor) {
        return new Response(JSON.stringify({ error: 'idCliente e valor são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const prodResult = await client.query(
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

      if (!prodResult || prodResult.length === 0) {
        return new Response(JSON.stringify({ configured: true, data: null }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const prod = prodResult[0]
      return new Response(
        JSON.stringify({
          configured: true,
          data: {
            produto_codigo: String(prod.produto_codigo),
            referencia: prod.referencia ?? null,
            codbarra: prod.codbarra ?? null,
            codigo_no_cliente: prod.codigo_no_cliente ?? null,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${body.action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro na execução da função MySQL:', error)
    return new Response(
      JSON.stringify({
        error: 'Falha ao conectar ou consultar o banco MySQL externo.',
        detail: (error as Error).message,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } finally {
    try {
      await client.close()
    } catch {
      // Ignora erro no fechamento
    }
  }
})
