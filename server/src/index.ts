import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { clienteRouter } from './routes/cliente'
import { produtoRouter } from './routes/produto'
import { requireApiKey } from './middleware/auth'
import { breakerStatus } from './db'

const app = express()
const port = Number(process.env.PORT ?? 3333)
const allowedOrigin = process.env.ALLOWED_ORIGIN

app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}))
app.use(express.json())

// Sem autenticação de propósito — útil para health checks de infra.
app.get('/health', (_req, res) => {
  res.json({ ok: true, breaker: breakerStatus() })
})

app.use(requireApiKey, clienteRouter)
app.use(requireApiKey, produtoRouter)

app.listen(port, () => {
  console.log(`[erp-bridge] ouvindo na porta ${port}`)
  if (!process.env.ALLOWED_ORIGIN) {
    console.warn('[erp-bridge] ALLOWED_ORIGIN não configurado — CORS liberado para qualquer origem.')
  }
})

// Importante: nunca derrubar o processo aqui. Um restart automático (Docker,
// PM2, etc.) recriaria o pool de conexão do zero — na prática, um retry
// disfarçado contra um serviço que pode bloquear IP após poucas falhas.
process.on('unhandledRejection', (err) => {
  console.error('[erp-bridge] unhandledRejection (processo mantido no ar):', err)
})
process.on('uncaughtException', (err) => {
  console.error('[erp-bridge] uncaughtException (processo mantido no ar):', err)
})
