import "server-only"

import type { z } from "zod"
import type { AtualizarCadastroBody, Cadastro, CriarCadastroBody } from "@/contracts/autoatendimento"
import { buscarPorDocumento, normalizarDocumento } from "@/lib/domain/clientes"
import type { Db } from "@/lib/domain/db"
import { DomainError } from "@/lib/domain/erros"
import { notFound } from "@/lib/http/erros"

type CadastroResposta = z.infer<typeof Cadastro>

// Só o que o cadastro devolve ou precisa decidir. Nunca address, notes nem gender.
const COLUNAS = "id, name, email, document, birth_date"

type Linha = { id: string; name: string; email: string | null; document: string | null; birth_date: string | null }

/**
 * CPF de 11 dígitos -> "***.***.789-01" (últimos 5 visíveis). Qualquer outro
 * formato -> "***" + últimos 4. Vazio -> null. O documento completo nunca sai.
 */
export function mascararDocumento(documento: string | null): string | null {
  const limpo = normalizarDocumento(documento)

  if (!limpo) return null

  if (/^\d{11}$/.test(limpo)) return `***.***.${limpo.slice(6, 9)}-${limpo.slice(9)}`

  return `***${limpo.slice(-4)}`
}

function paraCadastro(linha: Linha): CadastroResposta {
  return {
    id: linha.id,
    nome: linha.name,
    email: linha.email,
    documentoMascarado: mascararDocumento(linha.document),
    dataNascimentoInformada: linha.birth_date !== null,
  }
}

/** Mesma normalização do fluxo público: celular/fixo sem DDI ganha o 55 na frente. */
function telefoneComDdi(telefone: string) {
  const digitos = telefone.replace(/\D/g, "")

  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
}

async function carregarCliente(db: Db, orgId: string, clienteId: string): Promise<Linha> {
  const { data, error } = await db
    .from("customers")
    .select(COLUNAS)
    .eq("id", clienteId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    console.error("[autoatendimento:cadastro]", error)
    throw error
  }

  if (!data) throw notFound("Cadastro")

  return data
}

/** GET: o próprio cadastro, identificado pelo telefone do ticket. */
export async function lerCadastro(db: Db, orgId: string, clienteId: string): Promise<CadastroResposta> {
  return paraCadastro(await carregarCliente(db, orgId, clienteId))
}

/**
 * POST: só chamado quando a identificação é `desconhecido` (a rota garante).
 * Documento de outro cliente da org -> CUSTOMER_CONFLICT SEM vincular nem
 * atualizar esse cadastro: o documento pode ser de outra pessoa, e ligar um
 * telefone a um cadastro existente é decisão da equipe.
 * Não usa `resolverCliente`: ele reusa o cadastro que casa por documento.
 */
export async function criarCadastro(
  db: Db,
  orgId: string,
  telefoneDoTicket: string,
  entrada: CriarCadastroBody
): Promise<CadastroResposta> {
  const documento = normalizarDocumento(entrada.documento)

  if (!documento) {
    throw new DomainError("VALIDATION_ERROR", "Informe um documento válido (CPF ou CNPJ).")
  }

  if ((await buscarPorDocumento(db, orgId, documento)).length > 0) {
    throw new DomainError(
      "CUSTOMER_CONFLICT",
      "Já existe um cadastro com este documento. A equipe do estabelecimento precisa resolver; não é possível cadastrar por aqui."
    )
  }

  const { data, error } = await db
    .from("customers")
    .insert({
      organization_id: orgId,
      name: entrada.nome,
      phone: telefoneComDdi(telefoneDoTicket),
      document: documento,
      email: entrada.email ?? null,
      birth_date: entrada.dataNascimento ?? null,
      active: true,
    })
    .select(COLUNAS)
    .single()

  if (error || !data) {
    // 23505: outro pedido cadastrou o mesmo telefone ou documento entre a busca e o insert.
    if (error?.code === "23505") {
      throw new DomainError("CUSTOMER_CONFLICT", "Já existe um cadastro com estes dados. A equipe precisa resolver.")
    }

    console.error("[autoatendimento:cadastro]", error)
    throw error ?? new Error("insert de cliente sem retorno")
  }

  return paraCadastro(data)
}

/**
 * PATCH: nome, e-mail e data de nascimento sobrescrevem. Documento só entra se
 * o cadastro ainda não tem um (trocar documento por WhatsApp é o caminho de
 * apropriação de cadastro alheio); conflito com outro cliente -> CUSTOMER_CONFLICT.
 * O telefone nunca muda por aqui.
 */
export async function atualizarCadastro(
  db: Db,
  orgId: string,
  clienteId: string,
  entrada: AtualizarCadastroBody
): Promise<CadastroResposta> {
  const atual = await carregarCliente(db, orgId, clienteId)

  const mudancas: {
    name?: string
    email?: string
    birth_date?: string
    document?: string
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (entrada.nome !== undefined) mudancas.name = entrada.nome
  if (entrada.email !== undefined) mudancas.email = entrada.email
  if (entrada.dataNascimento !== undefined) mudancas.birth_date = entrada.dataNascimento

  if (entrada.documento !== undefined) {
    if (normalizarDocumento(atual.document)) {
      throw new DomainError(
        "INVALID_TRANSITION",
        "O documento deste cadastro já está registrado e não pode ser alterado por aqui. A equipe do estabelecimento pode ajudar."
      )
    }

    const documento = normalizarDocumento(entrada.documento)

    if (!documento) throw new DomainError("VALIDATION_ERROR", "Informe um documento válido (CPF ou CNPJ).")

    if ((await buscarPorDocumento(db, orgId, documento)).length > 0) {
      throw new DomainError(
        "CUSTOMER_CONFLICT",
        "Já existe um cadastro com este documento. A equipe do estabelecimento precisa resolver."
      )
    }

    mudancas.document = documento
  }

  const { data, error } = await db
    .from("customers")
    .update(mudancas)
    .eq("id", clienteId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .select(COLUNAS)
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      throw new DomainError("CUSTOMER_CONFLICT", "Já existe um cadastro com estes dados. A equipe precisa resolver.")
    }

    console.error("[autoatendimento:cadastro]", error)
    throw error
  }

  if (!data) throw notFound("Cadastro")

  return paraCadastro(data)
}
