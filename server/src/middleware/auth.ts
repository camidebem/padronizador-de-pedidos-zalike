import type { Request, Response, NextFunction } from 'express'

/**
 * Autenticação simples por chave compartilhada (header x-api-key).
 *
 * Isso NÃO é autenticação por usuário — hoje o login do frontend é mock
 * (qualquer credencial funciona), então não existe uma identidade real
 * para verificar ainda. Quando o login real for implementado, o ideal é
 * trocar isto por validação do token de sessão do PocketBase em vez de
 * uma chave estática — a chave fica visível em qualquer bundle JS público.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.API_KEY
  if (!expected) {
    console.warn('[auth] API_KEY não configurada — endpoint rodando SEM autenticação.')
    next()
    return
  }

  const provided = req.header('x-api-key')
  if (provided !== expected) {
    res.status(401).json({ error: 'API key inválida ou ausente.' })
    return
  }

  next()
}
