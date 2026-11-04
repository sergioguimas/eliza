import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { ChatWebBody, ChatWebResposta, MensagemWeb, TicketPayload, TicketVisitantePayload } from "@/contracts/autoatendimento"
import { emitirTicket, emitirTicketVisitante, validarTicket } from "@/lib/autoatendimento/ticket"
import { etapaDaEscolha, filtrarAcao } from "@/lib/marcar/acao-chat"

const segredo = "s".repeat(32)
const ORG = "11111111-1111-4111-8111-111111111111"
const SESS = "22222222-2222-4222-8222-222222222222"
const agora = new Date("2026-11-04T12:00:00Z")

test("ticket de visitante: emite e valida", () => {
  const t = emitirTicketVisitante({ org: ORG, sess: SESS }, { segredo, agora })
  const r = validarTicket(t.token, { segredo, agora })
  assert.equal(r.ok, true)
  assert.equal(r.tipo, "visitante")
  assert.equal(r.payload.org, ORG)
  assert.equal(r.payload.sess, SESS)
})

test("conversa e visitante não se confundem", () => {
  const c = emitirTicket({ org: ORG, tel: "5511999990000", inst: "x", msg: "m" }, { segredo, agora })
  const v = emitirTicketVisitante({ org: ORG, sess: SESS }, { segredo, agora })
  assert.equal(validarTicket(c.token, { segredo, agora }).tipo, "conversa")
  assert.equal(validarTicket(v.token, { segredo, agora }).tipo, "visitante")

  const payloadVisitante = JSON.parse(Buffer.from(v.token.split(".")[0], "base64url").toString())
  const payloadConversa = JSON.parse(Buffer.from(c.token.split(".")[0], "base64url").toString())
  assert.equal(TicketPayload.safeParse(payloadVisitante).success, false)
  assert.equal(TicketVisitantePayload.safeParse(payloadConversa).success, false)
})

test("ticket de visitante adulterado ou vencido é recusado", () => {
  const { token } = emitirTicketVisitante({ org: ORG, sess: SESS }, { segredo, agora })
  const trocado = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A")
  assert.deepEqual(validarTicket(trocado, { segredo, agora }), { ok: false, motivo: "invalido" })
  assert.deepEqual(validarTicket(token, { segredo: "o".repeat(32), agora }), { ok: false, motivo: "invalido" })
  const depois = new Date(agora.getTime() + 31 * 60 * 1000)
  assert.deepEqual(validarTicket(token, { segredo, agora: depois }), { ok: false, motivo: "expirado" })
})

// O sistema é dono do que é público (C17): marca e autenticador andam juntos.
test("marca x-atendente-publico e autenticador são coerentes", () => {
  const spec = readFileSync("lib/openapi/autoatendimento.ts", "utf8")
  const marcadas = [...spec.matchAll(/operationId: "(\w+)",\s*\n\s*"x-atendente": true,\s*\n\s*"x-atendente-publico": true/g)].map((m) => m[1])
  assert.deepEqual(marcadas.sort(), ["consultarHorarios", "listarProfissionais", "listarServicos"])
  assert.equal((spec.match(/"x-atendente-publico": true/g) ?? []).length, 3)

  const rota = (r) => readFileSync(`app/api/v1/autoatendimento/${r}/route.ts`, "utf8")
  for (const r of ["contexto", "servicos", "profissionais", "horarios"]) {
    assert.match(rota(r), /autenticar: autenticarTicketOuVisitante/, r)
  }
  for (const r of ["agendamentos", "cadastro", "mensagens", "escalonamentos", "cadastro/nome", "mensagens/[mensagemId]/midia"]) {
    assert.doesNotMatch(rota(r), /autenticarTicketOuVisitante/, r)
  }
})

test("corpo do chat é estrito e limita o texto", () => {
  const formulario = { etapa: 1, servicoId: null, profissionalId: null, data: null, hora: null }
  assert.equal(ChatWebBody.safeParse({ texto: "oi", formulario }).success, true)
  assert.equal(ChatWebBody.safeParse({ texto: "x".repeat(501), formulario }).success, false)
  assert.equal(ChatWebBody.safeParse({ texto: "   ", formulario }).success, false)
  assert.equal(ChatWebBody.safeParse({ texto: "oi", formulario, organizationId: ORG }).success, false)
  assert.equal(ChatWebBody.safeParse({ texto: "oi", formulario: { ...formulario, organizationId: ORG } }).success, false)
})

test("resposta do agens: ação vazia, tipo errado e excesso são recusados", () => {
  const acao = { tipo: "preencher_agendamento", data: "2026-11-06" }
  assert.equal(ChatWebResposta.safeParse({ resposta: "ok", acoes: [acao] }).success, true)
  assert.equal(ChatWebResposta.safeParse({ resposta: "ok", acoes: [{ tipo: "preencher_agendamento" }] }).success, false)
  assert.equal(ChatWebResposta.safeParse({ resposta: "ok", acoes: [{ tipo: "agendar", data: "2026-11-06" }] }).success, false)
  assert.equal(ChatWebResposta.safeParse({ resposta: "ok", acoes: [acao, acao, acao, acao] }).success, false)
  assert.equal(ChatWebResposta.safeParse({ resposta: "", acoes: [] }).success, false)
})

test("mensagem ao agens só aceita contato de sessão web", () => {
  const base = {
    versao: 1, canal: "web", mensagemId: SESS, orgId: ORG, texto: "oi", recebidaEm: "2026-11-04T12:00:00.000Z",
    ticket: { token: "t", expiraEm: "2026-11-04T12:30:00.000Z" },
    formulario: { etapa: 1, servicoId: null, profissionalId: null, data: null, hora: null },
  }
  assert.equal(MensagemWeb.safeParse({ ...base, contato: `web:${SESS}` }).success, true)
  assert.equal(MensagemWeb.safeParse({ ...base, contato: "5511999990000" }).success, false)
})

const pagina = { servicoIds: ["s1"], profissionalIds: ["p1"], hoje: new Date(2026, 10, 4, 15, 0) } // qua, 04/11

test("ação filtra o que não é da página", () => {
  const ok = filtrarAcao({ tipo: "preencher_agendamento", servicoId: "s1", profissionalId: "p1", data: "2026-11-06", hora: "14:00" }, pagina)
  assert.deepEqual(ok, { descartou: false, servicoId: "s1", profissionalId: "p1", data: "2026-11-06", hora: "14:00" })

  const outraOrg = filtrarAcao({ tipo: "preencher_agendamento", servicoId: "de-outra-org", data: "2026-11-06" }, pagina)
  assert.equal(outraOrg.descartou, true)
  assert.equal(outraOrg.servicoId, undefined)
  assert.equal(outraOrg.data, "2026-11-06")
})

test("data passada e domingo são descartados; hoje vale", () => {
  assert.equal(filtrarAcao({ tipo: "preencher_agendamento", data: "2026-11-03" }, pagina).data, undefined)
  assert.equal(filtrarAcao({ tipo: "preencher_agendamento", data: "2026-11-08" }, pagina).data, undefined) // domingo
  assert.equal(filtrarAcao({ tipo: "preencher_agendamento", data: "2026-11-04" }, pagina).data, "2026-11-04")
  assert.equal(filtrarAcao({ tipo: "preencher_agendamento", data: "2026-99-99" }, pagina).descartou, true)
})

test("etapa é a primeira com escolha faltando", () => {
  const cheio = { servicoId: "s", profissionalId: "p", data: new Date(), hora: "14:00" }
  assert.equal(etapaDaEscolha({ ...cheio, servicoId: "" }), 1)
  assert.equal(etapaDaEscolha({ ...cheio, profissionalId: "" }), 1)
  assert.equal(etapaDaEscolha({ ...cheio, hora: "" }), 2)
  assert.equal(etapaDaEscolha({ ...cheio, data: undefined }), 2)
  assert.equal(etapaDaEscolha(cheio), 3)
})
