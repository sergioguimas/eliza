import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo"

/**
 * O Brasil não tem mais horário de verão desde 2019, então São Paulo fica em
 * UTC-3 o ano inteiro e o deslocamento pode ser literal.
 */
export const SAO_PAULO_UTC_OFFSET = "-03:00"

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
 * O mês sai do fuso do negócio, não do relógio do servidor, e os limites levam
 * o deslocamento de São Paulo. Antes o mês vinha de `getFullYear`/`getMonth`
 * (hora local) e os limites eram `Z`: na VPS, que roda em UTC, a janela ficava
 * 3h adiantada — puxava as 21h–23h59 do último dia do mês anterior e largava
 * de fora esse mesmo horário do último dia do mês corrente.
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

  return {
    startDate,
    endDate,
    start: `${startDate}T00:00:00${SAO_PAULO_UTC_OFFSET}`,
    end: `${endDate}T23:59:59.999${SAO_PAULO_UTC_OFFSET}`,
  }
}