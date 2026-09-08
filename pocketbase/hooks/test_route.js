routerAdd('GET', '/api/zalike/test', (e) => {
  return e.json(200, { ok: true, message: 'hello from test hook' })
})
