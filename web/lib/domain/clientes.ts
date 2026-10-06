import "server-only"

import { brPhoneVariants } from "@/lib/phone-br"
import type { Db } from "./db"
import { DomainError } from "./erros"

export type NovoCliente = {
  nome: string
  telefone: string
  documento?: string | null
  dataNascimento?: string | null
  genero?: string | null
  email?: string | null
}

export type ClienteResumo = { id: string; nome: string; telefone: string; email: string | null }

const COLUNAS_CLIENTE = "id, name, phone, email"

/**
 * Mesma normalização do trigger `normalize_customer_fields`: só letras e
 * dígitos (documento pode ter letra, como RG). Se a busca normalizasse
 * diferente do banco, o `document_normalized = ?` nunca casaria.
 */
function normalizarDocumento(documento?: string | null): string | null {
  return documento?.replace(/[^0-9A-Za-z]/g, "") || null
}

const soDigitos = (valor?: string | null) => valor?.replace(/\D/g, "") || ""

/**
 * Clientes ativos da org cujo telefone casa, em qualquer forma BR (com/sem DDI,
 * com/sem o 9º dígito). Igualdade exata em `phone_normalized`, nunca sufixo.
 */
export async function buscarPorTelefone(db: Db, orgId: string, telefone: string): Promise<ClienteResumo[]> {
  const variantes = brPhoneVariants(telefone)

  if (variantes.length === 0) return []

  const { data, error } = await db
    .from("customers")
    .select(COLUNAS_CLIENTE)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .in("phone_normalized", variantes)

  if (error) {
    console.error("[domain:buscarPorTelefone]", error)
    throw error
  }

  return (data ?? []).map((c) => ({ id: c.id, nome: c.name, telefone: c.phone, email: c.email }))
}

async function buscarPorDocumento(db: Db, orgId: string, documento: string): Promise<ClienteResumo[]> {
  const { data, error } = await db
    .from("customers")
    .select(COLUNAS_CLIENTE)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .eq("document_normalized", documento)

  if (error) {
    console.error("[domain:buscarPorDocumento]", error)
    throw error
  }

  return (data ?? []).map((c) => ({ id: c.id, nome: c.name, telefone: c.phone, email: c.email }))
}

/** Telefone e documento podem apontar para o mesmo cadastro ou para dois: conta ids distintos. */
async function candidatos(db: Db, orgId: string, telefone: string, documento: string | null) {
  const [porTelefone, porDocumento] = await Promise.all([
    buscarPorTelefone(db, orgId, telefone),
    documento ? buscarPorDocumento(db, orgId, documento) : Promise.resolve([]),
  ])

  return [...new Map([...porTelefone, ...porDocumento].map((c) => [c.id, c])).values()]
}

function escolher(achados: ClienteResumo[]): { id: string; criado: false } | null {
  if (achados.length === 0) return null

  // Dois cadastros casam (o mesmo celular em duas formas, ou telefone de um e
  // documento de outro): não dá para saber qual é o certo, então não adivinha.
  if (achados.length > 1) {
    throw new DomainError("CUSTOMER_AMBIGUOUS", "Há mais de um cadastro com esses dados; informe o cliente.")
  }

  return { id: achados[0].id, criado: false }
}

/**
 * `{ id }` precisa existir na org e não estar apagado. Cliente novo: 0 casamentos
 * cria; 1 REUSA sem sobrescrever nada (dado de cadastro só muda pelo painel);
 * 2+ é CUSTOMER_AMBIGUOUS.
 */
export async function resolverCliente(
  db: Db,
  orgId: string,
  entrada: { id: string } | NovoCliente,
  opcoes: { exigirDocumento: boolean }
): Promise<{ id: string; criado: boolean }> {
  if ("id" in entrada) {
    const { data, error } = await db
      .from("customers")
      .select("id")
      .eq("id", entrada.id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle()

    // 22P02: id que não é UUID. Para quem chama é o mesmo que não existir.
    if (error && error.code !== "22P02") {
      console.error("[domain:resolverCliente]", error)
      throw error
    }

    if (!data) throw new DomainError("NOT_FOUND", "Cliente não encontrado.")

    return { id: data.id, criado: false }
  }

  const nome = entrada.nome?.trim()
  const telefone = soDigitos(entrada.telefone)
  const documento = normalizarDocumento(entrada.documento)

  if (!nome || !telefone || (opcoes.exigirDocumento && !documento)) {
    throw new DomainError(
      "VALIDATION_ERROR",
      opcoes.exigirDocumento
        ? "Nome, telefone e documento do paciente são obrigatórios."
        : "Nome e telefone do cliente são obrigatórios."
    )
  }

  const existente = escolher(await candidatos(db, orgId, telefone, documento))

  if (existente) return existente

  const { data: criado, error } = await db
    .from("customers")
    .insert({
      organization_id: orgId,
      name: nome,
      phone: telefone,
      document: documento,
      birth_date: entrada.dataNascimento ?? null,
      gender: entrada.genero ?? null,
      email: entrada.email ?? null,
      active: true,
    })
    .select("id")
    .single()

  if (error || !criado) {
    // 23505: outro pedido cadastrou o mesmo telefone/documento entre a busca e
    // o insert (índices únicos por org). Se agora há um só cadastro, reusa.
    if (error?.code === "23505") {
      const concorrente = escolher(await candidatos(db, orgId, telefone, documento))

      if (concorrente) return concorrente

      throw new DomainError("CUSTOMER_CONFLICT", "Já existe um cadastro com esses dados.")
    }

    console.error("[domain:resolverCliente]", error)
    throw error ?? new Error("insert de cliente sem retorno")
  }

  return { id: criado.id, criado: true }
}
