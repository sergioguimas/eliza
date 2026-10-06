'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient as createSessionClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { consumeRateLimit, hashIdentifier } from "@/lib/demo/rate-limit"
import { Database } from "@/utils/database.types"
import { criarAgendamento, type Ator } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { horaLocalParaUtc } from "@/lib/domain/tempo"

function onlyNumbers(value?: string | null) {
  return value?.replace(/\D/g, "") || null
}

// Limites do agendamento público (/marcar/[slug]). O contador é o mesmo de
// demo_rate_limits (RPC atômica, fail-closed), com prefixos próprios.
//   - IP e telefone de destino barram a CRIAÇÃO: é o eixo de spam (mensagem
//     saindo pelo número do tenant para um telefone qualquer).
//   - O teto por org barra só o ENVIO do WhatsApp. Se barrasse a criação,
//     um atacante com IPs e telefones rotativos fecharia a agenda pública do
//     tenant; assim o pior caso é o pedido entrar sem mensagem.
const PUBLIC_LIMIT_PER_IP = { windowMs: 60 * 60 * 1000, max: 10 }
const PUBLIC_LIMIT_PER_PHONE = { windowMs: 24 * 60 * 60 * 1000, max: 3 }
const PUBLIC_WHATSAPP_PER_ORG = { windowMs: 60 * 60 * 1000, max: 30 }

type BookingContext = {
  organizationId: string
  isPublic: boolean
  // Chamado antes de enviar o WhatsApp; false pula o envio.
  allowNotify?: () => Promise<boolean>
}

/**
 * Agendamento feito por alguém logado (painel, tour da demo).
 *
 * Server action é endpoint POST chamável diretamente, e o miolo roda com
 * service role — então a org NUNCA vem do FormData: sai do perfil da sessão.
 * O campo `organization_id` do form só é conferido.
 */
export async function createAppointment(formData: FormData) {
  const session = await createSessionClient<Database>()

  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) {
    return { error: "Sessão expirada. Entre novamente." }
  }

  const { data: profile } = await session
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: "Seu perfil não está vinculado a uma organização." }
  }

  const formOrganizationId = formData.get("organization_id")

  if (formOrganizationId && formOrganizationId !== profile.organization_id) {
    return { error: "Organização inválida para este usuário." }
  }

  return createAppointmentCore(formData, {
    organizationId: profile.organization_id,
    isPublic: false,
  })
}

async function getRequestIp() {
  const h = await headers()
  // Atrás do Traefik o primeiro item de x-forwarded-for é o do cliente
  // (mesma premissa de getClientIp em lib/demo/rate-limit.ts).
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()

  return forwarded || h.get("x-real-ip") || "unknown"
}

/**
 * Solicitação de agendamento pela página pública /marcar/[slug], sem sessão.
 *
 * Sempre nasce `pending` (o tenant aprova no painel), nunca aceita
 * `customer_id` nem dados de pagamento do form, e passa por rate limit.
 */
export async function createPublicAppointment(formData: FormData) {
  const supabase = createAdminClient<Database>()

  const organizationId = formData.get("organization_id")

  if (typeof organizationId !== "string" || !organizationId) {
    return { error: "Dados incompletos para realizar o agendamento." }
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle()

  if (!organization) {
    return { error: "Organização não encontrada." }
  }

  const rawPhone = onlyNumbers(formData.get("customer_phone") as string | null)

  if (!rawPhone) {
    return { error: "Nome, telefone e documento do paciente são obrigatórios." }
  }

  // Mesma normalização do envio (send-whatsapp): com e sem DDI contam juntos.
  const phone =
    rawPhone.length === 10 || rawPhone.length === 11 ? `55${rawPhone}` : rawPhone

  const ip = await getRequestIp()

  const byIp = await consumeRateLimit(
    supabase,
    hashIdentifier("booking-ip", ip),
    PUBLIC_LIMIT_PER_IP
  )

  if (!byIp.allowed) {
    return { error: "Muitas solicitações em pouco tempo. Tente novamente mais tarde." }
  }

  const byPhone = await consumeRateLimit(
    supabase,
    hashIdentifier("booking-phone", phone),
    PUBLIC_LIMIT_PER_PHONE
  )

  if (!byPhone.allowed) {
    return { error: "Este telefone já fez várias solicitações hoje. Aguarde o contato da equipe." }
  }

  return createAppointmentCore(formData, {
    organizationId: organization.id,
    isPublic: true,
    allowNotify: async () => {
      const byOrg = await consumeRateLimit(
        supabase,
        hashIdentifier("booking-org-whatsapp", organization.id),
        PUBLIC_WHATSAPP_PER_ORG
      )

      return byOrg.allowed
    },
  })
}

async function createAppointmentCore(formData: FormData, ctx: BookingContext) {
  const supabase = createAdminClient<Database>()

  const organization_id = ctx.organizationId
  const professional_id = formData.get("professional_id") as string
  const service_id = formData.get("service_id") as string
  const start_time_raw = formData.get("start_time") as string
  const notes = (formData.get("notes") as string) || null

  if (!organization_id || !start_time_raw || !professional_id || !service_id) {
    return { error: "Dados incompletos para realizar o agendamento." }
  }

  let startTime: Date

  try {
    startTime = horaLocalParaUtc(start_time_raw)
  } catch (error) {
    console.error("Erro ao interpretar horário do agendamento:", {
      start_time_raw,
      error,
    })

    return {
      error: "Horário do agendamento inválido.",
    }
  }

  // No fluxo público pagamento e cliente existente não vêm do visitante:
  // `customer_id` deixaria qualquer um agendar (e disparar mensagem) em nome
  // de um cliente já cadastrado. No painel o pagamento só entra se o form
  // mandar uma forma de pagamento (o domínio confere contra o enum do banco).
  const customerId = ctx.isPublic ? null : (formData.get("customer_id") as string | null)
  const paymentMethod = ctx.isPublic ? null : (formData.get("payment_method") as string | null) || null
  const paymentPaid = !ctx.isPublic && formData.get("payment_status") === "paid"

  const ator: Ator = {
    canal: ctx.isPublic ? "publico" : "painel",
    organizationId: organization_id,
    origem: ctx.isPublic ? "publico" : "painel",
    // Painel sempre avisa o cliente; o público passa pelo teto de envios por org.
    podeNotificar: ctx.allowNotify ?? (async () => true),
  }

  try {
    const { agendamento } = await criarAgendamento(supabase, ator, {
      cliente: customerId
        ? { id: customerId }
        : {
            nome: (formData.get("customer_name") as string | null) ?? "",
            telefone: onlyNumbers(formData.get("customer_phone") as string | null) ?? "",
            documento: onlyNumbers(formData.get("customer_document") as string | null),
            dataNascimento: (formData.get("customer_birth_date") as string) || null,
            genero: (formData.get("customer_gender") as string) || null,
          },
      profissionalId: professional_id,
      servicoId: service_id,
      inicio: startTime,
      observacao: notes,
      status: ctx.isPublic ? "pending" : "scheduled",
      pagamento:
        paymentMethod || paymentPaid
          ? { metodo: paymentMethod, status: paymentPaid ? "paid" : "pending" }
          : undefined,
    })

    revalidatePath("/agendamentos")
    revalidatePath("/dashboard")

    return {
      success: true,
      appointmentId: agendamento.id,
    }
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao criar agendamento:", error)
    return { error: "Erro ao salvar agendamento." }
  }
}
