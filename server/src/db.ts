import mysql from 'mysql2/promise'

/**
 * Pool de conexão único, criado uma única vez quando o processo sobe —
 * NUNCA criar uma conexão nova por requisição. O MySQL externo bloqueia
 * o IP após 5 tentativas com credencial errada, então este módulo:
 *
 *  1. Reaproveita sempre o mesmo pool (poucas conexões, connectionLimit baixo).
 *  2. Implementa um circuit breaker: depois de algumas falhas de CONEXÃO
 *     seguidas (não "não encontrado" — isso é resultado normal), para de
 *     tentar por um tempo em vez de martelar o servidor a cada requisição.
 *  3. Nunca derruba o processo (sem process.exit) em erro de banco — um
 *     crash-loop de restart seria, na prática, um retry-loop disfarçado.
 */

const FAILURE_THRESHOLD = 3
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos

let consecutiveFailures = 0
let breakerOpenUntil = 0

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  connectTimeout: 8000,
})

export class BreakerOpenError extends Error {
  constructor() {
    super(
      'Circuit breaker aberto: muitas falhas de conexão recentes com o MySQL externo. ' +
        'Aguardando o período de espera antes de tentar novamente, para não arriscar o bloqueio de firewall.',
    )
    this.name = 'BreakerOpenError'
  }
}

// Códigos que indicam problema de CONEXÃO/AUTENTICAÇÃO (contam para o breaker).
// Um erro de SQL malformado ou "0 linhas encontradas" não entra aqui.
const CONNECTION_LEVEL_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_HOST_NOT_PRIVILEGED',
  'ER_CON_COUNT_ERROR',
])

function isConnectionLevelError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code
  return typeof code === 'string' && CONNECTION_LEVEL_CODES.has(code)
}

export async function safeQuery<T>(sql: string, params: unknown[]): Promise<T> {
  const now = Date.now()
  if (now < breakerOpenUntil) {
    throw new BreakerOpenError()
  }

  try {
    const [rows] = await pool.query(sql, params)
    consecutiveFailures = 0
    return rows as T
  } catch (err) {
    if (isConnectionLevelError(err)) {
      consecutiveFailures += 1
      console.error(
        `[mysql] falha de conexão (${consecutiveFailures}/${FAILURE_THRESHOLD}):`,
        (err as Error).message,
      )
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        breakerOpenUntil = Date.now() + COOLDOWN_MS
        consecutiveFailures = 0
        console.error(`[mysql] circuit breaker aberto por ${COOLDOWN_MS / 1000}s`)
      }
    } else {
      console.error('[mysql] erro de query (não conta para o breaker):', (err as Error).message)
    }
    throw err
  }
}

export function breakerStatus() {
  const now = Date.now()
  return {
    open: now < breakerOpenUntil,
    consecutiveFailures,
    openUntil: breakerOpenUntil > now ? new Date(breakerOpenUntil).toISOString() : null,
  }
}
