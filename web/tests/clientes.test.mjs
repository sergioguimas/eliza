import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizarDataNascimento, resolverCliente } from "@/lib/domain/clientes"

const ORG = "11111111-1111-4111-8111-111111111111"

// Supabase de mentira, só o que resolverCliente usa: select com eq/is/in, insert(...).select().single().
function bancoFalso(linhas = []) {
  const clientes = linhas.map((l) => ({ organization_id: ORG, deleted_at: null, ...l }))
  const inseridos = []

  function consulta() {
    const filtros = []
    const q = {
      select: () => q,
      eq: (col, v) => (filtros.push((r) => r[col] === v), q),
      is: (col, v) => (filtros.push((r) => r[col] === v), q),
      in: (col, vs) => (filtros.push((r) => vs.includes(r[col])), q),
      maybeSingle: async () => ({ data: clientes.find((r) => filtros.every((f) => f(r))) ?? null, error: null }),
      then: (ok, erro) => Promise.resolve({ data: clientes.filter((r) => filtros.every((f) => f(r))), error: null }).then(ok, erro),
      insert: (linha) => {
        const nova = { id: `novo-${inseridos.length + 1}`, deleted_at: null, ...linha }
        inseridos.push(nova)
        return { select: () => ({ single: async () => ({ data: { id: nova.id }, error: null }) }) }
      },
    }
    return q
  }

  return { db: { from: () => consulta() }, inseridos }
}

const painel = { exigirNascimento: true }

test("data de nascimento: aceita AAAA-MM-DD real, recusa o resto", () => {
  assert.equal(normalizarDataNascimento("1990-05-10"), "1990-05-10")
  assert.equal(normalizarDataNascimento(""), null)
  assert.equal(normalizarDataNascimento(null), null)
  for (const ruim of ["10/05/1990", "1990-02-30", "1899-12-31", "2999-01-01"]) {
    assert.throws(() => normalizarDataNascimento(ruim), { codigo: "VALIDATION_ERROR" }, ruim)
  }
})

test("painel e público: sem data de nascimento recusa, sem documento cria", async () => {
  const { db, inseridos } = bancoFalso()

  await assert.rejects(
    resolverCliente(db, ORG, { nome: "Ana", telefone: "33999990000" }, painel),
    { codigo: "VALIDATION_ERROR", message: "Nome, telefone e data de nascimento são obrigatórios." }
  )

  const r = await resolverCliente(db, ORG, { nome: "Ana", telefone: "33999990000", dataNascimento: "1990-05-10" }, painel)
  assert.equal(r.criado, true)
  assert.equal(inseridos[0].document, null)
  assert.equal(inseridos[0].birth_date, "1990-05-10")
})

test("API e atendente seguem sem exigir nascimento nem documento", async () => {
  const { db } = bancoFalso()
  const r = await resolverCliente(db, ORG, { nome: "Ana", telefone: "33999990000" }, { exigirNascimento: false })
  assert.equal(r.criado, true)
})

test("duplicidade: a data de nascimento desempata, sem ela continua ambíguo", async () => {
  // telefone casa com um cadastro e o documento com outro
  const linhas = [
    { id: "a", name: "Ana", phone: "5533999990000", phone_normalized: "5533999990000", document_normalized: null, birth_date: "1990-05-10", email: null },
    { id: "b", name: "Ana Paula", phone: "5533988880000", phone_normalized: "5533988880000", document_normalized: "12345678900", birth_date: "1985-01-02", email: null },
  ]
  const entrada = { nome: "Ana", telefone: "5533999990000", documento: "123.456.789-00" }

  const { db } = bancoFalso(linhas)
  await assert.rejects(resolverCliente(db, ORG, entrada, { exigirNascimento: false }), { codigo: "CUSTOMER_AMBIGUOUS" })

  const r = await resolverCliente(db, ORG, { ...entrada, dataNascimento: "1985-01-02" }, painel)
  assert.deepEqual(r, { id: "b", criado: false })

  await assert.rejects(resolverCliente(db, ORG, { ...entrada, dataNascimento: "2000-01-01" }, painel), { codigo: "CUSTOMER_AMBIGUOUS" })
})
