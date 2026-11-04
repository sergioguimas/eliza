/**
 * Regras do treino sem dependência de servidor, banco ou framework: dá para
 * testar com `node --test` (contrato 10 §7).
 */

export type ErroTreino =
  | "INDISPONIVEL"
  | "TREINO_DESLIGADO"
  | "NAO_PERMITIDO"
  | "NAO_ENCONTRADO"
  | "SESSAO_ENCERRADA"
  | "SESSAO_CHEIA"
  | "TEXTO_LONGO"
  | "LIMITE_SESSOES"
  | "LIMITE_INSTRUCOES"

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: ErroTreino }

/** Tamanho mínimo do segredo, igual ao do agens. */
export const SEGREDO_TREINO_MIN = 32

/** CHECK da coluna `autoatendimento_config.instrucoes_atendimento`. */
export const INSTRUCOES_MAX = 2000

/** Tabela do contrato 10 §3. O que não está nela é INDISPONIVEL, e o motivo fica só no log. */
export function traduzirErro(status: number, codigo: string | undefined): ErroTreino {
  if (status === 404) return codigo === "TREINO_DESLIGADO" ? "TREINO_DESLIGADO" : "NAO_ENCONTRADO"
  if (status === 403 && codigo === "PAPEL_NAO_PERMITIDO") return "NAO_PERMITIDO"
  if (status === 409 && (codigo === "SESSAO_ENCERRADA" || codigo === "SESSAO_CHEIA")) return codigo
  if (status === 422 && codigo === "TEXTO_LONGO") return "TEXTO_LONGO"
  if (status === 429 && codigo === "LIMITE_SESSOES") return "LIMITE_SESSOES"
  return "INDISPONIVEL"
}

export function treinoConfigurado(url: string | undefined, segredo: string | undefined) {
  return Boolean(url?.trim()) && (segredo?.length ?? 0) >= SEGREDO_TREINO_MIN
}

export function papelTreina(papel: string | null | undefined): papel is "owner" | "admin" {
  return papel === "owner" || papel === "admin"
}

/** Primeiro nome, até 40 caracteres (contrato 10 §3). */
export function primeiroNome(nome: string | null | undefined) {
  const primeiro = nome?.trim().split(/\s+/)[0]

  return primeiro ? primeiro.slice(0, 40) : null
}

export type NovaInstrucao = { tipo: "ja_existe" } | { tipo: "limite" } | { tipo: "novo"; valor: string }

/**
 * Passos 3 e 4 de `aplicarNota` (contrato 10 §5.5). Idempotente por texto:
 * reaplicar depois de `MARCACAO_PENDENTE` não duplica a linha.
 */
export function acrescentarInstrucao(atual: string | null | undefined, texto: string): NovaInstrucao {
  const linha = `- ${texto}`
  const base = (atual ?? "").trimEnd()

  if (base.split("\n").includes(linha)) return { tipo: "ja_existe" }

  const valor = base ? `${base}\n${linha}` : linha

  return valor.length > INSTRUCOES_MAX ? { tipo: "limite" } : { tipo: "novo", valor }
}
