// Hook de busca de cliente por CNPJ via MySQL externo
// Rota: POST /api/custom/buscar-cliente

routerAdd('POST', '/api/custom/buscar-cliente', (e) => {
  const password = $os.getenv('MYSQL_PASSWORD')
  if (!password) {
    return e.json(400, {
      configured: false,
      error:
        'Senha do banco MySQL (MYSQL_PASSWORD) não foi configurada no servidor. Por favor, configure a variável de ambiente.',
    })
  }

  const info = e.requestInfo()
  const body = info.body || {}
  const rawCnpj = (body.cnpj || '').trim()

  if (!rawCnpj) {
    return e.json(400, {
      configured: true,
      error: 'CNPJ do cliente não informado.',
    })
  }

  return e.json(200, {
    configured: true,
    data: null,
    message: 'Test hook',
  })
})
