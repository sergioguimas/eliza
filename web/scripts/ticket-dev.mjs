#!/usr/bin/env node
/**
 * Gera um ticket de DESENVOLVIMENTO da API de Autoatendimento, para testar pelo
 * Swagger (/api/v1/docs). Imprime só o ticket, para colar no campo "Ticket".
 *
 * Uso (de dentro de web/):
 *   node scripts/ticket-dev.mjs <orgId> <telefone> <instancia> [mensagemId]
 *
 *   orgId       uuid da organização (organizations.id)
 *   telefone    só dígitos, com DDI (ex.: 5511900000001)
 *   instancia   organizations.whatsapp_instance_name (a API confere que ainda é a da org)
 *   mensagemId  opcional; padrão "swagger-dev"
 *
 * Lê AUTOATENDIMENTO_TICKET_SECRET de web/.env.local (nunca o imprime). O
 * formato é o de lib/autoatendimento/ticket.ts: base64url(JSON).base64url(HMAC-SHA256),
 * TTL de 30 minutos. Recusa rodar com NODE_ENV=production.
 */
import { createHmac } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const TTL_SEGUNDOS = 30 * 60
const TAMANHO_MINIMO_SEGREDO = 32
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function falhar(mensagem) {
  console.error(`ticket-dev: ${mensagem}`)
  process.exit(1)
}

if (process.env.NODE_ENV === "production") {
  falhar("recusado: NODE_ENV=production. Este script é só para desenvolvimento.")
}

const [org, tel, inst, msg = "swagger-dev"] = process.argv.slice(2)

if (!org || !tel || !inst) {
  falhar("uso: node scripts/ticket-dev.mjs <orgId> <telefone> <instancia> [mensagemId]")
}

if (!UUID.test(org)) falhar("orgId precisa ser um uuid.")
if (!/^\d{10,15}$/.test(tel)) falhar("telefone precisa ter de 10 a 15 dígitos, sem pontuação (ex.: 5511900000001).")

const arquivo = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local")

if (!existsSync(arquivo)) falhar("web/.env.local não encontrado.")

function lerSegredo() {
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?AUTOATENDIMENTO_TICKET_SECRET\s*=\s*(.*?)\s*$/)

    if (m) return m[1].replace(/^(['"])(.*)\1$/, "$2")
  }

  return ""
}

const segredo = lerSegredo()

if (segredo.length < TAMANHO_MINIMO_SEGREDO) {
  falhar("AUTOATENDIMENTO_TICKET_SECRET ausente ou com menos de 32 caracteres em web/.env.local.")
}

const iat = Math.floor(Date.now() / 1000)
const payload = Buffer.from(JSON.stringify({ v: 1, org, tel, inst, msg, iat, exp: iat + TTL_SEGUNDOS })).toString("base64url")
const assinatura = createHmac("sha256", segredo).update(payload).digest("base64url")

console.log(`${payload}.${assinatura}`)
