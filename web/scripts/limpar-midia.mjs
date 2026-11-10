#!/usr/bin/env node
/**
 * Limpeza do disco da biblioteca de fotos (docs/contratos/midia-vitrine/01 §7). Node puro, sem dependência
 * (fala com o PostgREST por fetch). Roda DENTRO do container:
 *   docker exec elisa-app node scripts/limpar-midia.mjs            # só lista
 *   docker exec elisa-app node scripts/limpar-midia.mjs --aplicar  # apaga (casos a e .tmp)
 *   docker exec elisa-app node scripts/limpar-midia.mjs --aplicar --confirmo-orfas  # apaga também o caso (b)
 *
 * Apaga <MEDIA_DIR>/<id>/ quando:
 *   (a) org_media.deleted_at tem mais de 30 dias (e depois apaga a linha);
 *   (b) não existe linha com o id (org apagada em cascata) E o diretório tem mais de 30 dias de mtime.
 * Também apaga <id>.tmp/ com mais de 1 hora (upload interrompido).
 * Usa NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente; MEDIA_DIR como o app
 * (vazio = <cwd>/.media).
 */

import { readdir, rm, stat } from "node:fs/promises"
import path from "node:path"

const DIAS_30 = 30 * 24 * 60 * 60 * 1000
const HORA_1 = 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TMP = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.tmp$/

const aplicar = process.argv.includes("--aplicar")
const confirmoOrfas = process.argv.includes("--confirmo-orfas")
const raiz = process.env.MEDIA_DIR?.trim() || path.join(process.cwd(), ".media")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "")
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !chave) {
  console.error("FALHOU: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const cab = { apikey: chave, Authorization: `Bearer ${chave}` }

let houveErro = false

/** Falha do DELETE depois do `rm` não pode travar o resto: registra, marca o código de saída e segue. */
async function restSeguro(caminho, opcoes) {
  try {
    const r = await fetch(`${url}/rest/v1/${caminho}`, { ...opcoes, headers: { ...cab, ...opcoes.headers } })
    if (r.ok) return true
    console.error(`ERRO: ${opcoes.method} ${caminho.split("?")[0]} -> ${r.status} ${await r.text()}`)
  } catch (erro) {
    console.error(`ERRO: ${opcoes.method} ${caminho.split("?")[0]} -> ${erro.message}`)
  }
  houveErro = true
  return false
}

async function rest(caminho, opcoes = {}) {
  const r = await fetch(`${url}/rest/v1/${caminho}`, { ...opcoes, headers: { ...cab, ...opcoes.headers } })
  if (!r.ok) {
    console.error(`FALHOU: ${opcoes.method ?? "GET"} ${caminho.split("?")[0]} -> ${r.status} ${await r.text()}`)
    process.exit(1)
  }
  return r
}

const agora = Date.now()
const corte = new Date(agora - DIAS_30).toISOString()

// (a) fotos excluídas há mais de 30 dias
const excluidas = await (await rest(`org_media?select=id,deleted_at&deleted_at=lt.${encodeURIComponent(corte)}`)).json()
const idsExcluidas = new Set(excluidas.map((l) => l.id))

let entradas = []
try {
  entradas = await readdir(raiz, { withFileTypes: true })
} catch (erro) {
  if (erro.code !== "ENOENT") throw erro
  console.log(`(pasta ${raiz} não existe: nada em disco)`)
}

const diretorios = entradas.filter((e) => e.isDirectory())
const idsEmDisco = diretorios.map((e) => e.name).filter((n) => UUID.test(n))

// (b) diretórios sem linha: consulta só os ids que existem em disco e não estão em (a)
const candidatosB = idsEmDisco.filter((id) => !idsExcluidas.has(id))
const comLinha = new Set()
for (let i = 0; i < candidatosB.length; i += 100) {
  const lote = candidatosB.slice(i, i + 100)
  const linhas = await (await rest(`org_media?select=id&id=in.(${lote.join(",")})`)).json()
  for (const l of linhas) comLinha.add(l.id)
}

const alvos = []

for (const nome of diretorios.map((e) => e.name)) {
  const tmp = TMP.exec(nome)
  const caminho = path.join(raiz, nome)

  if (tmp) {
    const { mtimeMs } = await stat(caminho)
    if (agora - mtimeMs > HORA_1) alvos.push({ nome, caminho, motivo: "upload interrompido (.tmp > 1 h)", linha: null })
    continue
  }

  if (!UUID.test(nome)) continue // nunca mexe no que não é uma pasta de foto

  if (idsExcluidas.has(nome)) {
    alvos.push({ nome, caminho, motivo: "excluída há mais de 30 dias", linha: nome })
  } else if (!comLinha.has(nome)) {
    const { mtimeMs } = await stat(caminho)
    if (agora - mtimeMs > DIAS_30) alvos.push({ nome, caminho, motivo: "sem linha no banco e > 30 dias", linha: null })
  }
}

// Trava do caso (b): se a consulta não reconheceu NENHUM id existente, ou se os órfãos passam de 20% das
// pastas, o mais provável é consulta errada (base errada, chave sem acesso), não lixo de verdade. Aborta.
const alvosB = alvos.filter((a) => a.motivo.startsWith("sem linha"))

if (candidatosB.length > 0 && comLinha.size === 0) {
  console.error(`ABORTADO: ${candidatosB.length} pasta(s) em disco e a consulta não reconheceu nenhuma. Confira NEXT_PUBLIC_SUPABASE_URL e a chave; nada foi apagado.`)
  process.exit(1)
}

if (alvosB.length > 0 && alvosB.length > idsEmDisco.length * 0.2) {
  console.error(`ABORTADO: ${alvosB.length} de ${idsEmDisco.length} pastas seriam apagadas como órfãs (> 20%). Investigue antes; nada foi apagado.`)
  process.exit(1)
}

// linhas excluídas há mais de 30 dias cujo diretório já não existe também saem do banco
const linhasSemDiretorio = [...idsExcluidas].filter((id) => !idsEmDisco.includes(id))

console.log(`${aplicar ? "APLICANDO" : "SIMULAÇÃO (use --aplicar para apagar)"} em ${raiz}`)
for (const a of alvos) {
  const ehB = a.motivo.startsWith("sem linha")
  const acao = aplicar && (!ehB || confirmoOrfas) ? "apaga" : "apagaria"
  console.log(`${acao}  ${a.nome}  ${a.motivo}`)
}
if (alvosB.length > 0 && !(aplicar && confirmoOrfas)) {
  console.log(`AVISO: ${alvosB.length} pasta(s) órfã(s) (sem linha no banco) só são apagadas com --aplicar --confirmo-orfas.`)
}
for (const id of linhasSemDiretorio) console.log(`${aplicar ? "apaga" : "apagaria"}  linha ${id}  excluída há mais de 30 dias, sem pasta`)
if (alvos.length === 0 && linhasSemDiretorio.length === 0) console.log("nada a limpar")

if (aplicar) {
  let pastas = 0
  let linhas = 0

  for (const a of alvos) {
    if (a.motivo.startsWith("sem linha") && !confirmoOrfas) continue

    try {
      await rm(a.caminho, { recursive: true, force: true })
      pastas += 1
    } catch (erro) {
      console.error(`ERRO: rm ${a.nome} -> ${erro.message}`)
      houveErro = true
      continue
    }

    if (a.linha && (await restSeguro(`org_media?id=eq.${a.linha}&deleted_at=lt.${encodeURIComponent(corte)}`, { method: "DELETE" }))) linhas += 1
  }

  for (const id of linhasSemDiretorio) {
    if (await restSeguro(`org_media?id=eq.${id}&deleted_at=lt.${encodeURIComponent(corte)}`, { method: "DELETE" })) linhas += 1
  }

  console.log(`feito: ${pastas} pasta(s), ${linhas} linha(s)${houveErro ? " (com erros, veja acima)" : ""}`)
  if (houveErro) process.exit(1)
}
