import assert from "node:assert/strict"
import { test } from "node:test"

import { dataCurta, descreverMudanca, descreverOrigem, descreverPadrao, descreverPerfil } from "../components/atendente-treino/descrever.ts"
import { assinarEncaminhamento, assinarTreino } from "../lib/autoatendimento/assinatura.ts"
import {
  acrescentarInstrucao,
  INSTRUCOES_MAX,
  papelTreina,
  primeiroNome,
  traduzirErro,
  treinoConfigurado,
} from "../lib/autoatendimento/treino-regras.ts"

// Vetores da specs/06 §4 do sola-agens, calculados fora do Go e do Node.
const SEGREDO = "segredo-de-treino-com-mais-de-32-bytes"
const TS = "1800000000"
const CORPO = '{"operador":{"tenant":"org-1","id":"u1","papel":"owner","nome":"Ana"}}'
const IDENTIDADE = "org-1.u1.owner"

test("assinatura bate com os vetores do agens", () => {
  assert.equal(
    assinarTreino(SEGREDO, TS, "POST", "/sessoes", CORPO),
    "4a1b3a0095223988b879a08c0150ed2a69e31e900b18192cd3d6098a5719713c"
  )
  assert.equal(
    assinarTreino(SEGREDO, TS, "GET", "/perfil", IDENTIDADE),
    "c974379c14cc79d83c920aadda3951d7c72635053b25f0abd37636700d099902"
  )
  assert.equal(
    assinarTreino(SEGREDO, TS, "DELETE", "/perfil", IDENTIDADE),
    "41706b734ba1250b05e4d82e8027b92f5716ee6d929179fb4fa12fba69203470"
  )
})

test("assinatura de uma rota não vale em outra", () => {
  assert.notEqual(assinarTreino(SEGREDO, TS, "GET", "/perfil", IDENTIDADE), assinarTreino(SEGREDO, TS, "DELETE", "/perfil", IDENTIDADE))
  assert.notEqual(
    assinarTreino(SEGREDO, TS, "GET", "/notas?estado=pendente", IDENTIDADE),
    assinarTreino(SEGREDO, TS, "GET", "/notas?estado=aplicada", IDENTIDADE)
  )
})

test("o encaminhamento continua assinando só timestamp e corpo", () => {
  assert.equal(assinarEncaminhamento("segredo", "1800000000", "corpo"), "b25a47306998b682ffc0f253cc4ea852e3b58c8d6124e4116f140b598f205447")
})

test("erros do agens viram os do contrato", () => {
  const casos = [
    [404, "TREINO_DESLIGADO", "TREINO_DESLIGADO"],
    [404, "NAO_ENCONTRADO", "NAO_ENCONTRADO"],
    [401, "NAO_AUTORIZADO", "INDISPONIVEL"],
    [403, "PAPEL_NAO_PERMITIDO", "NAO_PERMITIDO"],
    [409, "SESSAO_ENCERRADA", "SESSAO_ENCERRADA"],
    [409, "SESSAO_CHEIA", "SESSAO_CHEIA"],
    [422, "TEXTO_LONGO", "TEXTO_LONGO"],
    [429, "LIMITE_SESSOES", "LIMITE_SESSOES"],
    [500, "ERRO_INTERNO", "INDISPONIVEL"],
    [503, undefined, "INDISPONIVEL"],
  ]
  for (const [status, codigo, quer] of casos) assert.equal(traduzirErro(status, codigo), quer, `${status} ${codigo}`)
})

test("só owner e admin treinam", () => {
  assert.ok(papelTreina("owner"))
  assert.ok(papelTreina("admin"))
  for (const papel of ["professional", "staff", "", null, undefined]) assert.equal(papelTreina(papel), false)
})

test("o treino exige URL e segredo de 32 caracteres", () => {
  const segredo = "x".repeat(32)
  assert.ok(treinoConfigurado("http://a", segredo))
  assert.equal(treinoConfigurado("http://a", "x".repeat(31)), false)
  assert.equal(treinoConfigurado("  ", segredo), false)
  assert.equal(treinoConfigurado(undefined, segredo), false)
  assert.equal(treinoConfigurado("http://a", undefined), false)
})

test("primeiro nome", () => {
  assert.equal(primeiroNome("  Ana Maria Souza "), "Ana")
  assert.equal(primeiroNome("x".repeat(50)), "x".repeat(40))
  assert.equal(primeiroNome("   "), null)
  assert.equal(primeiroNome(null), null)
})

test("aplicar nota acrescenta linha", () => {
  assert.deepEqual(acrescentarInstrucao(null, "Abre domingo"), { tipo: "novo", valor: "- Abre domingo" })
  assert.deepEqual(acrescentarInstrucao("", "Abre domingo"), { tipo: "novo", valor: "- Abre domingo" })
  assert.deepEqual(acrescentarInstrucao("Seja breve.  \n", "Abre domingo"), { tipo: "novo", valor: "Seja breve.\n- Abre domingo" })
})

test("aplicar a mesma nota não duplica", () => {
  assert.deepEqual(acrescentarInstrucao("Seja breve.\n- Abre domingo", "Abre domingo"), { tipo: "ja_existe" })
  // Só a linha inteira conta: trecho igual em outra frase não é a mesma nota.
  assert.equal(acrescentarInstrucao("- Abre domingo cedo", "Abre domingo").tipo, "novo")
})

test("aplicar nota respeita o limite de 2.000 caracteres", () => {
  const cheio = "x".repeat(INSTRUCOES_MAX - 5)
  assert.deepEqual(acrescentarInstrucao(cheio, "123456789"), { tipo: "limite" })
  assert.equal(acrescentarInstrucao(cheio, "12").tipo, "novo") // "\n- 12" = 5 caracteres: bate o limite
})

const vazio = {
  tratamento: null,
  saudacoes: [],
  despedidas: [],
  emojis: { uso: null, preferidos: [], evitar: [] },
  pontuacao: { exclamacao: null, reticencias: null, risada: null },
  comprimento: null,
  vocabulario: { preferir: [], evitar: [] },
  tom: [],
  exemplos: [],
}

test("perfil vazio não descreve nada", () => {
  assert.deepEqual(descreverPerfil(vazio), [])
})

test("perfil em linguagem simples", () => {
  const linhas = descreverPerfil({
    ...vazio,
    tratamento: "voce",
    saudacoes: ["Oii flor!"],
    emojis: { uso: "frequente", preferidos: ["💅", "✨"], evitar: ["😂"] },
    pontuacao: { exclamacao: "normal", reticencias: false, risada: null },
    comprimento: "curto",
    tom: ["carinhosa", "informal"],
    exemplos: [{ cenario: "atraso", resposta: "Tranquilo!" }],
  })
  assert.deepEqual(linhas, [
    "Trata o cliente por você",
    "Tom: carinhosa, informal",
    "Costuma cumprimentar com: “Oii flor!”",
    "Usa emojis com frequência: 💅 ✨",
    "Nunca usa: 😂",
    "Exclamação: normal",
    "Não usa reticências",
    "Mensagens curtas",
    "1 exemplo real de resposta",
  ])
})

test("mudança em linguagem simples", () => {
  assert.equal(descreverMudanca({ campo: "emojis.preferidos", antes: ["✨"], depois: ["✨", "💅"] }), "Emojis preferidos: ✨ → ✨, 💅")
  assert.equal(descreverMudanca({ campo: "tratamento", antes: null, depois: "voce" }), "Tratamento: nada → você")
  assert.equal(descreverMudanca({ campo: "pontuacao.reticencias", antes: true, depois: false }), "Reticências: sim → não")
  assert.equal(descreverMudanca({ campo: "exemplos", antes: [], depois: [{}, {}] }), "Exemplos: nada → 2 exemplos")
  assert.equal(descreverMudanca({ campo: "novo.campo", antes: "a", depois: "b" }), "novo.campo: a → b")
})

test("padrão não mostra valor interno", () => {
  assert.equal(descreverPadrao("pontuacao.reticencias", "nao"), "Reticências: não")
  assert.equal(descreverPadrao("pontuacao.risada", "sim"), "Risada: sim")
  assert.equal(descreverPadrao("comprimento", "curto"), "Tamanho das mensagens: curtas")
  assert.equal(descreverPadrao("emojis.uso", "frequente"), "Uso de emojis: com frequência")
  assert.equal(descreverPadrao("tratamento", "pelo_nome"), "Tratamento: nome")
  assert.equal(descreverPadrao("saudacoes", "Oii flor"), "Saudações: Oii flor")
})

test("data e origem da versão concordam no fuso de Brasília", () => {
  // 23h de 03/11 em Brasília já é 04/11 em UTC: achado na tela.
  const criadaEm = "2026-11-04T02:00:00Z"
  assert.equal(dataCurta(criadaEm), "03/11/2026")
  assert.equal(descreverOrigem({ origem: "sessao:abc", criadaEm }), "treino de 03/11")
})

test("origem da versão", () => {
  const criadaEm = "2026-10-27T03:00:00Z"
  assert.equal(descreverOrigem({ origem: "sessao:abc", criadaEm }), "treino de 27/10")
  assert.equal(descreverOrigem({ origem: "volta:3", criadaEm }), "voltou para a v3")
  assert.equal(descreverOrigem({ origem: "edicao", criadaEm }), "edição")
  assert.equal(descreverOrigem({ origem: "zerado", criadaEm }), "começou do zero")
})
