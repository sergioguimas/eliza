import assert from "node:assert/strict"
import { test } from "node:test"

import { dentroDaAgendaVisivel } from "@/lib/domain/agenda-visivel"

const HOJE = "2026-11-07"

test("0 dias = agenda fechada: recusa até hoje", () => {
  assert.equal(dentroDaAgendaVisivel("2026-11-07", HOJE, 0), false)
  assert.equal(dentroDaAgendaVisivel("2026-11-08", HOJE, 0), false)
})

test("1 dia aceita hoje e amanhã, recusa depois de amanhã e ontem", () => {
  assert.equal(dentroDaAgendaVisivel("2026-11-07", HOJE, 1), true)
  assert.equal(dentroDaAgendaVisivel("2026-11-08", HOJE, 1), true)
  assert.equal(dentroDaAgendaVisivel("2026-11-09", HOJE, 1), false)
  assert.equal(dentroDaAgendaVisivel("2026-11-06", HOJE, 1), false)
})

test("a janela atravessa virada de mês e ano", () => {
  assert.equal(dentroDaAgendaVisivel("2027-01-05", "2026-12-30", 6), true)
  assert.equal(dentroDaAgendaVisivel("2027-01-06", "2026-12-30", 6), false)
})
