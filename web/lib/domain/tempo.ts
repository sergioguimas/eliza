import { DomainError } from "./erros"

/**
 * Fonte única de fuso do sistema. Antes havia quatro cópias da conversão
 * (create-appointment, update-appointment, lib/api/tempo e um offset fixo em
 * get-available-slots); o offset fixo erraria se o Brasil voltasse a ter
 * horário de verão. O Intl resolve o offset da data pedida.
 * Arquivo puro (sem banco, sem segredo), importado também por código do navegador (lib/utils, dashboard).
 */
export const FUSO = "America/Sao_Paulo"

// Formatter único: construir Intl.DateTimeFormat é caro e a listagem de
// horários converte dezenas de pontos por chamada.
const formatadorDePartes = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function partesNoFuso(instante: Date) {
  const partes = formatadorDePartes.formatToParts(instante)
  const pegar = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)

  return {
    year: pegar("year"),
    month: pegar("month"),
    day: pegar("day"),
    // hour12:false devolve "24" à meia-noite em alguns runtimes.
    hour: pegar("hour") % 24,
    minute: pegar("minute"),
    second: pegar("second"),
  }
}

const dois = (n: number) => String(n).padStart(2, "0")

/** Relógio de SP (componentes soltos) -> instante UTC. */
function relogioParaUtc(y: number, mo: number, d: number, h: number, mi: number) {
  const palpite = new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0))
  const p = partesNoFuso(palpite)
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  return new Date(palpite.getTime() - (comoUtc - palpite.getTime()))
}

/**
 * "2026-10-05T14:30" (relógio de SP, sem offset) -> instante UTC.
 * Também aceita ISO com offset ou Z ("2026-10-05T17:30:00Z"), usado como está.
 * Malformado -> DomainError VALIDATION_ERROR.
 *
 * `campo` só entra na mensagem de erro, para o chamador (a API) apontar o
 * campo que o cliente errou.
 */
export function horaLocalParaUtc(valor: string, campo = "start_time"): Date {
  const texto = valor.trim()
  const relogio = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)

  let data: Date

  if (relogio) {
    const [, y, mo, d, h, mi] = relogio.map(Number)
    data = relogioParaUtc(y, mo, d, h, mi)

    // Date.UTC "rola" componentes fora de faixa (30/02 vira 02/03, 25h vira o
    // dia seguinte). Se o relógio de volta não bate, a entrada era inválida.
    const esperado = `${relogio[1]}-${relogio[2]}-${relogio[3]}T${relogio[4]}:${relogio[5]}`

    if (!Number.isNaN(data.getTime()) && utcParaHoraLocal(data) !== esperado) {
      data = new Date(NaN)
    }
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(texto)) {
    data = new Date(texto)
  } else {
    data = new Date(NaN)
  }

  if (Number.isNaN(data.getTime())) {
    throw new DomainError(
      "VALIDATION_ERROR",
      `Campo "${campo}" inválido. Use "YYYY-MM-DDTHH:mm" (horário de São Paulo) ou ISO 8601 com offset.`
    )
  }

  return data
}

/** Instante -> "2026-10-05T14:30" no relógio de SP. */
export function utcParaHoraLocal(instante: Date | string): string {
  const p = partesNoFuso(typeof instante === "string" ? new Date(instante) : instante)

  return `${p.year}-${dois(p.month)}-${dois(p.day)}T${dois(p.hour)}:${dois(p.minute)}`
}

export type Momento = { utc: string; local: string } // ISO UTC + "AAAA-MM-DDTHH:mm"

export function momento(instante: Date | string): Momento {
  const d = typeof instante === "string" ? new Date(instante) : instante

  return { utc: d.toISOString(), local: utcParaHoraLocal(d) }
}

/** "AAAA-MM-DD" local -> [início, fim) do dia em UTC. */
export function limitesDoDiaUtc(data: string): { inicio: Date; fim: Date } {
  const [y, m, d] = data.split("-").map(Number)
  const seguinte = new Date(Date.UTC(y, m - 1, d + 1))

  return {
    inicio: relogioParaUtc(y, m, d, 0, 0),
    fim: relogioParaUtc(seguinte.getUTCFullYear(), seguinte.getUTCMonth() + 1, seguinte.getUTCDate(), 0, 0),
  }
}

/** Dia de calendário ("AAAA-MM-DD") em que o instante cai, no relógio de SP. */
export function dataLocal(instante: Date): string {
  return utcParaHoraLocal(instante).slice(0, 10)
}

/** 0 = domingo. Data de calendário pura: não depende do fuso do servidor. */
export function diaDaSemanaLocal(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay()
}

export function minutosDoDiaLocal(instante: Date): number {
  const p = partesNoFuso(instante)

  return p.hour * 60 + p.minute
}
