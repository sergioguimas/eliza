'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient as createSessionClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { consumeRateLimit, hashIdentifier } from "@/lib/demo/rate-limit"
import { sendWhatsAppMessage } from "./send-whatsapp"
import { checkProfessionalAvailability, checkOrganizationBusinessHours } from "@/lib/appointment-config"
import { Database } from "@/utils/database.types"
import { horaLocalParaUtc } from "@/lib/domain/tempo"

type AppointmentInsert = Database["public"]["Tables"]["appointments"]["Insert"]

function onlyNumbers(value?: string | null) {
  return value?.replace(/\D/g, "") || null
}

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function renderMessageTemplate(
  template: string | null | undefined,
  variables: Record<string, string | number | null | undefined>
) {
  if (!template) return null

  return template.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, key) => {
    const value = variables[key]
    return value === null || value === undefined ? "" : String(value)
  })
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

  const is_public_booking = ctx.isPublic

  // No fluxo público pagamento e cliente existente não vêm do visitante:
  // `customer_id` deixaria qualquer um agendar (e disparar mensagem) em nome
  // de um cliente já cadastrado.
  const payment_method = is_public_booking
    ? null
    : (formData.get("payment_method") as any) || null
  const payment_status = is_public_booking
    ? "pending"
    : (formData.get("payment_status") as any) || "pending"

  let customer_id = is_public_booking
    ? null
    : (formData.get("customer_id") as string | null)

  const customer_name = formData.get("customer_name") as string | null
  const customer_phone = onlyNumbers(formData.get("customer_phone") as string | null)
  const customer_document = onlyNumbers(formData.get("customer_document") as string | null)
  const customer_birth_date = (formData.get("customer_birth_date") as string) || null
  const customer_gender = (formData.get("customer_gender") as string) || null

  let customer_found_name = ""

  if (!organization_id || !start_time_raw || !professional_id || !service_id) {
    return { error: "Dados incompletos para realizar o agendamento." }
  }

  if (!customer_id) {
    if (!customer_name || !customer_phone || !customer_document) {
      return { error: "Nome, telefone e documento do paciente são obrigatórios." }
    }

    const orFilters = [
      customer_document ? `document.eq.${customer_document}` : null,
      customer_phone ? `phone.eq.${customer_phone}` : null,
    ]
      .filter(Boolean)
      .join(",")

    const { data: existingCustomer, error: findCustomerError } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("organization_id", organization_id)
      .or(orFilters)
      .maybeSingle()

    if (findCustomerError) {
      console.error("Erro ao buscar paciente:", findCustomerError)
      return { error: "Erro ao verificar cadastro do paciente." }
    }

    if (existingCustomer) {
      customer_id = existingCustomer.id
      customer_found_name = existingCustomer.name
    } else {
      const { data: newCustomer, error: insertCustomerError } = await supabase
        .from("customers")
        .insert({
          organization_id,
          name: customer_name,
          phone: customer_phone,
          document: customer_document,
          birth_date: customer_birth_date,
          gender: customer_gender,
          active: true,
        })
        .select("id, name")
        .single()

      if (insertCustomerError || !newCustomer) {
        console.error("Erro ao criar paciente:", insertCustomerError)
        return { error: "Erro ao processar dados do paciente." }
      }

      customer_id = newCustomer.id
      customer_found_name = newCustomer.name
    }
  }

  if (!customer_id) {
    return { error: "Paciente não identificado para o agendamento." }
  }

  const { data: finalCustomer, error: finalCustomerError } = await supabase
    .from("customers")
    .select("id, name, phone")
    .eq("id", customer_id)
    .eq("organization_id", organization_id)
    .single()

  if (finalCustomerError || !finalCustomer) {
    console.error("Erro ao buscar paciente final:", finalCustomerError)
    return { error: "Erro ao buscar dados do paciente para notificação." }
  }

  const finalCustomerName = finalCustomer.name
  const finalCustomerPhone = onlyNumbers(finalCustomer.phone)

  // O filtro por organização não é decorativo: esta action roda com service
  // role, então o RLS não escopa nada e `service_id` vem do formData. Sem ele,
  // dava para agendar na org A usando serviço (e preço) da org B.
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes, price, title")
    .eq("id", service_id)
    .eq("organization_id", organization_id)
    .single()

  if (serviceError || !service) {
    console.error("Erro ao buscar serviço:", serviceError)
    return { error: "Serviço não encontrado." }
  }

  // Mesmo motivo: sem o escopo, `professional_id` do formData podia apontar
  // para profissional de outro tenant — o agendamento nasceria na org A com a
  // agenda de alguém da org B, e a notificação sairia para o telefone dele.
  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("name, phone")
    .eq("id", professional_id)
    .eq("organization_id", organization_id)
    .single()

  if (professionalError || !professional) {
    console.error("Erro ao buscar profissional:", professionalError)
    return { error: "Profissional não encontrado." }
  }

  const { data: settings } = await supabase
    .from("organization_settings")
    .select(`
      msg_appointment_pending,
      msg_appointment_created
    `)
    .eq("organization_id", organization_id)
    .maybeSingle()

  const duration_minutes = service.duration_minutes || 30
  const price = service.price || 0

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

  const endTime = new Date(startTime.getTime() + duration_minutes * 60000)

  const organizationAvailability = await checkOrganizationBusinessHours(
    supabase,
    organization_id,
    startTime,
    endTime
  )

  if (!organizationAvailability.available) {
    return { error: organizationAvailability.message }
  }

  const availability = await checkProfessionalAvailability(
    supabase,
    professional_id,
    startTime,
    endTime
  )

  if (!availability.available) {
    return { error: availability.message }
  }

  const appointmentData: AppointmentInsert = {
    organization_id,
    customer_id,
    professional_id,
    service_id,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    notes,
    price,
    payment_method,
    payment_status,
    status: is_public_booking ? "pending" : "scheduled",
  }

  const { data: newAppointment, error: insertError } = await supabase
    .from("appointments")
    .insert(appointmentData)
    .select("id")
    .single()

  if (insertError) {
    if (insertError.code === "23P01") {
      return {
        error: "Este horário acabou de ser ocupado. Por favor, escolha outro.",
      }
    }

    console.error("Erro Supabase:", insertError)
    return { error: "Erro ao salvar agendamento." }
  }

 const appointmentDateTime = formatDateTime(startTime)

  const appointmentDate = startTime.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })

  const appointmentTime = startTime.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  })

  const templateVariables = {
    appointment_id: newAppointment.id,

    customer_name: finalCustomerName,
    customer_phone: finalCustomerPhone,

    professional_name: professional.name,
    professional_phone: professional.phone,

    service_title: service.title,
    service_name: service.title,

    appointment_datetime: appointmentDateTime,
    start_time: appointmentDateTime,

    duration_minutes,
    price,
    notes,

    // aliases antigos dos templates
    name: finalCustomerName,
    service: service.title,
    date: appointmentDate,
    time: appointmentTime,
  }

  const template = is_public_booking
    ? settings?.msg_appointment_pending
    : settings?.msg_appointment_created

  const fallbackMessage = is_public_booking
    ? `Olá ${finalCustomerName}, sua solicitação de ${service.title} foi recebida para ${appointmentDate} às ${appointmentTime}. Em breve confirmaremos seu atendimento.`
    : `Olá ${finalCustomerName}, seu ${service.title} foi marcado com sucesso para ${appointmentDate} às ${appointmentTime}. Aguardamos por você!`

  const message =
    renderMessageTemplate(template, templateVariables) || fallbackMessage

  const notifyAllowed = ctx.allowNotify ? await ctx.allowNotify() : true

  if (!notifyAllowed) {
    console.warn("🚫 Teto de WhatsApp do agendamento público atingido; mensagem não enviada.", {
      appointmentId: newAppointment.id,
      organizationId: organization_id,
    })
  } else if (finalCustomerPhone) {
    console.log("Enviando mensagem de confirmação do agendamento para WhatsApp:", {
      appointmentId: newAppointment.id,
      organizationId: organization_id,
      customerPhone: finalCustomerPhone,
      message,
    })
    const whatsappResult = await sendWhatsAppMessage({
      phone: finalCustomerPhone,
      message,
      organizationId: organization_id,
    })

    if (!whatsappResult.success) {
      console.error("Erro ao enviar mensagem de confirmação do agendamento:", {
        appointmentId: newAppointment.id,
        organizationId: organization_id,
        customerPhone: finalCustomerPhone,
        whatsappResult,
      })
    }
  } else {
    console.warn("Paciente sem telefone. Mensagem de confirmação não enviada.", {
      appointmentId: newAppointment.id,
      customerId: finalCustomer.id,
    })
  }

  revalidatePath("/agendamentos")
  revalidatePath("/dashboard")

  return {
    success: true,
    appointmentId: newAppointment.id,
  }
}