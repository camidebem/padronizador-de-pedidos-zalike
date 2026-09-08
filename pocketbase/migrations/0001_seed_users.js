migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  try {
    app.findAuthRecordByEmail('users', 'camilyjeon@gmail.com')
  } catch (_) {
    const record = new Record(users)
    record.setEmail('camilyjeon@gmail.com')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Admin Zalike')
    app.save(record)
  }

  try {
    app.findAuthRecordByEmail('users', 'visitante@app.local')
  } catch (_) {
    const visitor = new Record(users)
    visitor.setEmail('visitante@app.local')
    visitor.setPassword('Skip@Pass123456')
    visitor.setVerified(true)
    visitor.set('name', 'Serviço Pedidos Zalike')
    app.save(visitor)
  }
}, (app) => {
  try {
    const record = app.findAuthRecordByEmail('users', 'camilyjeon@gmail.com')
    app.delete(record)
  } catch (_) {}
  try {
    const visitor = app.findAuthRecordByEmail('users', 'visitante@app.local')
    app.delete(visitor)
  } catch (_) {}
})
