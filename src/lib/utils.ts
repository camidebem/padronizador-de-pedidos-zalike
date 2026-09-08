/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza e formata CNPJ no padrão brasileiro XX.XXX.XXX/XXXX-XX.
 * - Idempotente: se já estiver formatado, não gera dupla pontuação.
 * - Se tiver exatamente 14 dígitos numéricos, aplica a máscara.
 * - Se for vazio ou nulo, retorna string vazia.
 * - Se for parcial ou inválido (diferente de 14 dígitos), retorna limpo sem quebrar.
 */
export function formatCnpj(val: string | null | undefined): string {
  if (!val) return ''
  const trimmed = String(val).trim()
  if (!trimmed) return ''

  // Extrai apenas dígitos
  const digits = trimmed.replace(/\D/g, '')

  // Se tiver exatamente 14 dígitos, formata: XX.XXX.XXX/XXXX-XX
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  // Se já for uma máscara válida de 18 caracteres
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // Tolerante a valores parciais ou inválidos: mantém original sem quebrar
  return trimmed
}

/**
 * Remove qualquer caractere não numérico de um CNPJ.
 */
export function cleanCnpj(val: string | null | undefined): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '').trim()
}
