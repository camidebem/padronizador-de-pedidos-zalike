import { OrderHeader, OrderItem } from '@/hooks/use-order'
import { formatCnpj } from './utils'

/**
 * Cliente para o microsserviço "zalike-erp-bridge" (pasta server/ na raiz
 * do projeto), que é a única peça que fala diretamente com o MySQL
 * externo (zalike_ia). O frontend NUNCA deve ter credencial de banco —
 * só a URL pública do bridge e, opcionalmente, uma API key de aplicação.
 *
 * Toda função aqui degrada silenciosamente para "não encontrado" em caso
 * de erro de rede, timeout, ou o bridge estar com o circuit breaker aberto
 * — o objetivo é que o preenchimento automático nunca trave o fluxo manual
 * que já existe. Erros são só logados no console para diagnóstico.
 */

export interface ClienteLookupResult {
  idCliente: string
  idConvenio: string | null
  formaPagtoCodigo: string
  formaPagtoDescricao: string
  repCode: string
}

export interface ProdutoLookupResult {
  produtoCodigo: string
}

function getApiBase(): string | undefined {
  const url = import.meta.env.VITE_ERP_API_URL as string | undefined
  if (!url) return undefined
  return url.replace(/\/+$/, '')
}

async function erpFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const base = getApiBase()
  if (!base) {
    // Autofill desligado: VITE_ERP_API_URL não configurada. Não é um erro
    // — o sistema continua funcionando 100% manual, como hoje.
    return null
  }

  const apiKey = import.meta.env.VITE_ERP_API_KEY as string | undefined
  const url = new URL(path, base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  try {
    const response = await fetch(url.toString(), {
      headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    })

    if (response.status === 404) return null

    if (!response.ok) {
      console.warn(
        `[erp] ${path} respondeu ${response.status} — seguindo com preenchimento manual.`,
      )
      return null
    }

    return (await response.json()) as T
  } catch (error) {
    console.warn(`[erp] falha ao chamar ${path} — seguindo com preenchimento manual.`, error)
    return null
  }
}

export function lookupCliente(cnpj: string): Promise<ClienteLookupResult | null> {
  const maskedCnpj = formatCnpj(cnpj)
  return erpFetch<ClienteLookupResult>('/cliente', { cnpj: maskedCnpj })
}

export function lookupProduto(
  idCliente: string,
  valor: string,
): Promise<ProdutoLookupResult | null> {
  return erpFetch<ProdutoLookupResult>('/produto', { idCliente, valor })
}

/**
 * Executa `fn` para cada item de `items`, mas no máximo `limit` chamadas em
 * paralelo por vez (em vez de Promise.all disparando tudo de uma vez).
 *
 * Isso existe porque o bridge (server/) só abre um pool de 3 conexões com o
 * MySQL e tem um circuit breaker que abre após 3 falhas consecutivas
 * (ficando bloqueado por minutos). Um pedido com muitos itens (ex: 38, ou
 * uma página de um lote de 55 pedidos) disparando todas as buscas ao mesmo
 * tempo facilmente satura esse pool — principalmente logo após o Render
 * "acordar" do modo economia de energia, quando a primeira leva de
 * requisições é mais lenta. O resultado observado era TODOS os itens
 * daquele pedido voltando como "não encontrado" de uma vez, mesmo com os
 * dados corretos no banco — assinatura de circuit breaker aberto, não de
 * cadastro faltando.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const current = nextIndex++
      if (current >= items.length) return
      results[current] = await fn(items[current])
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

/**
 * Fluxo 1: a partir do CNPJ já presente no header, busca cliente/forma de
 * pagamento/representante e devolve um header com os campos preenchidos.
 * Nunca sobrescreve um valor que o usuário já tenha digitado manualmente.
 */
export async function enrichHeaderFromCnpj(header: OrderHeader): Promise<OrderHeader> {
  const formattedCnpj = formatCnpj(header.cnpj)
  if (!formattedCnpj) {
    return header
  }

  const result = await lookupCliente(formattedCnpj)
  if (!result) {
    // Mesmo sem match no ERP, garante que o header fique com o CNPJ devidamente mascarado
    return {
      ...header,
      cnpj: formattedCnpj,
    }
  }

  return {
    ...header,
    cnpj: formattedCnpj,
    idCliente: result.idCliente,
    repCode: header.repCode.trim() ? header.repCode : result.repCode,
    paymentCode: header.paymentCode.trim() ? header.paymentCode : result.formaPagtoCodigo,
    paymentDesc: header.paymentDesc.trim() ? header.paymentDesc : result.formaPagtoDescricao,
  }
}

/**
 * Fluxo 2: roda a busca de produto para cada item, em paralelo, usando o
 * idCliente já resolvido no Fluxo 1. Só preenche itens que ainda não têm
 * Código Interno — nunca sobrescreve edição manual do usuário.
 */
const PRODUTO_LOOKUP_CONCURRENCY = 3

export async function enrichItemsWithIdCliente(
  items: OrderItem[],
  idCliente: string | null | undefined,
): Promise<OrderItem[]> {
  if (!idCliente) return items

  return mapWithConcurrency(items, PRODUTO_LOOKUP_CONCURRENCY, async (item) => {
    if (item.itemCode.trim()) return item

    const valor = item.barcode.trim() || item.reference.trim()
    if (!valor) return item

    const result = await lookupProduto(idCliente, valor)
    if (!result) return item

    return { ...item, itemCode: result.produtoCodigo }
  })
}
