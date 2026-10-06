import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { limitesDoDiaUtc } from "@/lib/domain/tempo"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo"

export function formatSaoPauloTime(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

export function formatSaoPauloDayMonth(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TIME_ZONE,
    day: "2-digit",
    month: "long",
  }).format(new Date(value))
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

/**
 * Faixa do mês do painel financeiro, fonte única para `getFinancialSummary` e
 * para o card Financeiro do dashboard — os dois precisam somar exatamente os
 * mesmos agendamentos, senão o card e a página que ele abre se contradizem.
 *
 * O mês sai do fuso do negócio, não do relógio do servidor. Os limites usam
 * `limitesDoDiaUtc` em vez de um deslocamento literal de UTC-3, que erraria se o Brasil
 * voltasse a ter horário de verão.
 *
 * `startDate`/`endDate` saem sem hora, para colunas `date` como `expenses.due_date`.
 */
export function getFinancialMonthRange(dateParam?: string) {
  const monthKey =
    dateParam ??
    new Date()
      .toLocaleDateString("en-CA", { timeZone: SAO_PAULO_TIME_ZONE })
      .slice(0, 7)

  const [year, month] = monthKey.split("-").map(Number)
  // Dia 0 do mês seguinte é o último dia deste. Em UTC para o próprio cálculo
  // não escorregar de volta para a hora local do servidor.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const startDate = `${monthKey}-01`
  const endDate = `${monthKey}-${lastDay}`

  // limitesDoDiaUtc retorna instantes UTC; fim é exclusivo (meia-noite do dia seguinte).
  // Os chamadores usam .lte(), então subtraímos 1ms de fim para manter semântica inclusiva.
  return {
    startDate,
    endDate,
    start: limitesDoDiaUtc(startDate).inicio.toISOString(),
    end: new Date(limitesDoDiaUtc(endDate).fim.getTime() - 1).toISOString(),
  }
}