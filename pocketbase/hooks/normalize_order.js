routerAdd('POST', '/api/zalike/normalize-order', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const rawText = (body.text || '').trim()

    if (!rawText) {
      return e.json(400, { error: 'O texto bruto para extração é obrigatório.' })
    }

    // Resolve user for Skip AI Agent chat: e.auth.id if authenticated, or the visitor service account
    let userId = e.auth?.id
    if (!userId) {
      try {
        const visitor = $app.findAuthRecordByEmail('users', 'visitante@app.local')
        userId = visitor.id
      } catch (_) {
        try {
          const admin = $app.findAuthRecordByEmail('users', 'camilyjeon@gmail.com')
          userId = admin.id
        } catch (uErr) {
          return e.json(500, { error: 'Usuário do sistema para execução de IA não encontrado.' })
        }
      }
    }

    const message =
      'Por favor, processe e normalize o texto do pedido a seguir, retornando rigorosamente o JSON conforme instruído:\n\n' +
      rawText

    const result = $ai.agent('extrator-pedidos').chat({
      user_id: userId,
      conversation_id: null,
      message: message,
    })

    const rawContent = (result.content || '').trim()

    // Clean any markdown formatting if present
    let jsonStr = rawContent
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // Try finding JSON block {...} if response contains surrounding conversational text
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
    }

    let parsed
    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseErr) {
      // Degrade gracefully with raw content
      return e.json(200, {
        ok: false,
        rawContent: result.content,
        orders: [],
        warning: 'A IA retornou um formato não estruturado. Use o modo manual.',
      })
    }

    return e.json(200, {
      ok: true,
      orders: parsed.orders || [],
      rawContent: result.content,
    })
  } catch (err) {
    let msg = 'Erro ao consultar IA de normalização.'
    if (err && err.message) {
      msg = err.message
    }
    return e.json(500, { error: msg })
  }
})
