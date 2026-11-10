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
const CAMPOS_DATA = ["atualizadoEm", "categorias", "organizacao", "servicos", "vitrine"]
const CAMPOS_SERVICO = ["adicionais", "categoria", "descricao", "duracaoMinutos", "id", "nome", "preco", "precoAPartirDe"]
const CAMPOS_CATEGORIA = ["foto", "nome"]
const CAMPOS_FOTO = ["alt", "altura", "cor", "largura", "url", "urlPequena"]
const CAMPOS_ITEM_VITRINE = ["categoria", "foto", "id", "legenda"]
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
conferir(
  igual(chaves(corpo.data), CAMPOS_DATA),
  "data = organizacao, servicos, categorias, vitrine, atualizadoEm",
  chaves(corpo.data)
)
conferir(
  igual(chaves(corpo.data.organizacao), ["nome", "slug"]),
  "organizacao = nome, slug",
  chaves(corpo.data.organizacao)
)
conferir(Array.isArray(corpo.data.servicos), "servicos é lista")
conferir(corpo.data.servicos.length <= 30, "no máximo 30 serviços", corpo.data.servicos.length)

corpo.data.servicos.forEach((s, i) => {
  conferir(
    igual(chaves(s), CAMPOS_SERVICO),
    `servicos[${i}] = id, nome, descricao, duracaoMinutos, preco, precoAPartirDe, categoria, adicionais`,
    chaves(s)
  )
  conferir(s.categoria === null || typeof s.categoria === "string", `servicos[${i}].categoria é string ou null`, s.categoria)
  conferir(typeof s.precoAPartirDe === "boolean", `servicos[${i}].precoAPartirDe é boolean`, s.precoAPartirDe)
})

// 1b. categorias e vitrine (04 §5): listas fechadas, sempre presentes
const norm = (t) => String(t).trim().toLowerCase()
const urlsDeFoto = []

function conferirFoto(foto, onde) {
  conferir(igual(chaves(foto), CAMPOS_FOTO), `${onde}.foto = url, urlPequena, largura, altura, alt, cor`, chaves(foto))
  urlsDeFoto.push(foto.url, foto.urlPequena)
}

conferir(Array.isArray(corpo.data.categorias), "categorias é lista")
corpo.data.categorias.forEach((c, i) => {
  conferir(igual(chaves(c), CAMPOS_CATEGORIA), `categorias[${i}] = nome, foto`, chaves(c))
  conferir(
    corpo.data.servicos.some((s) => s.categoria && norm(s.categoria) === norm(c.nome)),
    `categorias[${i}].nome ("${c.nome}") aparece em algum servicos[].categoria`
  )
  if (c.foto !== null) conferirFoto(c.foto, `categorias[${i}]`)
})

conferir(Array.isArray(corpo.data.vitrine), "vitrine é lista")
conferir(corpo.data.vitrine.length <= 24, "no máximo 24 itens na vitrine", corpo.data.vitrine.length)
corpo.data.vitrine.forEach((v, i) => {
  conferir(igual(chaves(v), CAMPOS_ITEM_VITRINE), `vitrine[${i}] = id, legenda, categoria, foto`, chaves(v))
  conferirFoto(v.foto, `vitrine[${i}]`)
})

// HEAD nas primeiras 3 fotos (url grande): 200, image/webp, immutable, sem set-cookie
for (const foto of urlsDeFoto.filter((_, i) => i % 2 === 0).slice(0, 3)) {
  const h = await fetch(foto, { method: "HEAD", redirect: "manual" })
  conferir(h.status === 200, `HEAD ${foto}: 200`, h.status)
  conferir(h.headers.get("content-type") === "image/webp", "foto com content-type image/webp", h.headers.get("content-type"))
  conferir((h.headers.get("cache-control") ?? "").includes("immutable"), "foto com cache-control immutable", h.headers.get("cache-control"))
  conferir(!h.headers.has("set-cookie"), "foto sem set-cookie", h.headers.get("set-cookie"))
}
if (urlsDeFoto.length === 0) console.log("--  sem fotos no catálogo: HEAD nas fotos não verificado")

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
