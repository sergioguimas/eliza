import { ApiError } from "./http"

export const API_TIME_ZONE = "America/Sao_Paulo"

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: API_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)

  // hour12:false devolve "24" à meia-noite em alguns runtimes.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  }
}

/** Hora de relógio de São Paulo ("2026-10-05T14:30") -> instante UTC. */
function wallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0, 0))
  const p = partsInZone(guess)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  return new Date(guess.getTime() - (asUtc - guess.getTime()))
}

/**
 * Aceita hora de relógio de São Paulo sem offset ("2026-10-05T14:30") ou um
 * instante ISO com `Z`/offset. Qualquer outra coisa é 422.
 */
export function parseApiDateTime(raw: string, field = "start_time") {
  const value = raw.trim()
  const wall = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)

  let date: Date

  if (wall) {
    const [, y, mo, d, h, mi] = wall.map(Number)
    date = wallTimeToUtc(y, mo, d, h, mi)
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    date = new Date(value)
  } else {
    date = new Date(NaN)
  }

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      `Campo "${field}" inválido. Use "YYYY-MM-DDTHH:mm" (horário de São Paulo) ou ISO 8601 com offset.`
    )
  }

  return date
}

/** "2026-10-05T14:30" no fuso de São Paulo. */
export function toLocalString(iso: string | Date) {
  const p = partsInZone(typeof iso === "string" ? new Date(iso) : iso)
  const pad = (n: number) => String(n).padStart(2, "0")

  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/** Início e fim (UTC) do dia "YYYY-MM-DD" em São Paulo. */
export function dayBoundsUtc(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(Number)
  const start = wallTimeToUtc(y, m, d, 0, 0)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const end = wallTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0)

  return { start, end }
}
