#!/usr/bin/env node
/**
 * Verifica o contrato da API pública (docs/contratos/api-publica/README.md §5)
 * contra um servidor no ar. Node puro, sem dependência.
 *
 * Uso:
 *   node web/scripts/verificar-api-publica.mjs <base-url> <slug> [origem-permitida]
 *   ex.: node web/scripts/verificar-api-publica.mjs http://localhost:3001 admin http://localhost:3200
 *
 * Sai com código 1 na primeira falha, dizendo o que falhou. Não testa o 429
 * (gastaria a cota de 120/min do IP); a lista de campos abaixo é fechada de
 * propósito: campo novo na resposta reprova até alguém atualizar este arquivo.
 */

const CAMPOS_TOPO = ["data"]
const CAMPOS_DATA = ["atualizadoEm", "organizacao", "servicos"]
const CAMPOS_SERVICO = ["categoria", "descricao", "duracaoMinutos", "id", "nome", "preco"]
const CACHE_ESPERADO = "public, max-age=30, stale-while-revalidate=300"

const [baseBruta, slug, origemPermitida] = process.argv.slice(2)

if (!baseBruta || !slug) {
  console.error("uso: node web/scripts/verificar-api-publica.mjs <base-url> <slug> [origem-permitida]")
  process.exit(1)
}

const base = baseBruta.replace(/\/+$/, "")
const url = (s) => `${base}/api/public/v1/orgs/${s}/catalogo`
let total = 0

function falhar(mensagem) {
  console.error(`\nFALHOU: ${mensagem}`)
  process.exit(1)
}

function conferir(condicao, descricao, detalhe) {
  total += 1
  if (!condicao) falhar(`${descricao}${detalhe !== undefined ? `\n  recebido: ${JSON.stringify(detalhe)}` : ""}`)
  console.log(`ok  ${descricao}`)
}

const chaves = (obj) => Object.keys(obj).sort()
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

async function pegar(s, headers = {}, method = "GET") {
  return fetch(url(s), { method, headers, redirect: "manual" })
}

// 1. 200 e formato fechado
const resp = await pegar(slug)
conferir(resp.status === 200, `GET ${slug}: 200`, resp.status)

const corpo = await resp.json()
conferir(igual(chaves(corpo), CAMPOS_TOPO), "chaves de topo = [data]", chaves(corpo))
conferir(igual(chaves(corpo.data), CAMPOS_DATA), "data = organizacao, servicos, atualizadoEm", chaves(corpo.data))
conferir(
  igual(chaves(corpo.data.organizacao), ["nome", "slug"]),
  "organizacao = nome, slug",
  chaves(corpo.data.organizacao)
)
conferir(Array.isArray(corpo.data.servicos), "servicos é lista")
conferir(corpo.data.servicos.length <= 30, "no máximo 30 serviços", corpo.data.servicos.length)

corpo.data.servicos.forEach((s, i) => {
  conferir(igual(chaves(s), CAMPOS_SERVICO), `servicos[${i}] = id, nome, descricao, duracaoMinutos, preco, categoria`, chaves(s))
  conferir(s.categoria === null || typeof s.categoria === "string", `servicos[${i}].categoria é string ou null`, s.categoria)
})

// 2. cabeçalhos
conferir(!resp.headers.has("set-cookie"), "sem set-cookie", resp.headers.get("set-cookie"))
conferir(resp.headers.get("cache-control") === CACHE_ESPERADO, "cache-control do contrato", resp.headers.get("cache-control"))
const etag = resp.headers.get("etag")
conferir(Boolean(etag), "etag presente", etag)

// 3. 304 com If-None-Match
const r304 = await pegar(slug, { "If-None-Match": etag })
conferir(r304.status === 304, "If-None-Match com o etag -> 304", r304.status)

// 4. 404 igual para slug inexistente e inválido
const inexistente = await pegar(`nao-existe-${Math.random().toString(36).slice(2, 10)}`)
const invalido = await pegar("BAD!")
conferir(inexistente.status === 404, "slug inexistente -> 404", inexistente.status)
conferir(invalido.status === 404, "slug inválido -> 404", invalido.status)

const semRequestId = (c) => {
  const copia = structuredClone(c)
  if (copia?.error) delete copia.error.request_id
  return copia
}
const corpoInexistente = await inexistente.json()
const corpoInvalido = await invalido.json()
conferir(
  igual(semRequestId(corpoInexistente), semRequestId(corpoInvalido)),
  "corpo do 404 idêntico (exceto request_id)",
  { inexistente: corpoInexistente, invalido: corpoInvalido }
)

// 5 e 6. CORS
if (origemPermitida) {
  const comOrigem = await pegar(slug, { Origin: origemPermitida })
  conferir(
    comOrigem.headers.get("access-control-allow-origin") === origemPermitida,
    "origem permitida recebe access-control-allow-origin igual a ela",
    comOrigem.headers.get("access-control-allow-origin")
  )

  const foraDaLista = await pegar(slug, { Origin: "https://exemplo.invalid" })
  conferir(
    !foraDaLista.headers.has("access-control-allow-origin"),
    "origem fora da lista sem access-control-allow-origin",
    foraDaLista.headers.get("access-control-allow-origin")
  )

  const preflight = await pegar(slug, { Origin: origemPermitida, "Access-Control-Request-Method": "GET" }, "OPTIONS")
  conferir(preflight.status === 204, "OPTIONS com origem permitida -> 204", preflight.status)
} else {
  console.log("--  CORS não verificado (passe a origem permitida como 3º argumento)")
}

console.log(`\n${total} verificações passaram (429 não testado de propósito).`)
