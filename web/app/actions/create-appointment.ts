'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { sendWhatsAppMessage } from "./send-whatsapp"
import { checkProfessionalAvailability, checkOrganizationBusinessHours } from "@/lib/appointment-config"
import { Database } from "@/utils/database.types"

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

const TIME_ZONE = "America/Sao_Paulo"

function getDatePartsInTimeZone(date: Date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value
    return Number(value)
  }

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone = TIME_ZONE) {
  const parts = getDatePartsInTimeZone(date, timeZone)

  const utcFromTimeZoneParts = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return utcFromTimeZoneParts - date.getTime()
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = TIME_ZONE
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)

  return new Date(utcGuess.getTime() - offset)
}

function parseAppointmentWallTimeToUtc(rawValue: string) {
  const raw = rawValue.trim()

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/
  )

  if (!match) {
    throw new Error("Formato de data/hora inválido.")
  }

  const [, year, month, day, hour, minute] = match.map(Number)

  return zonedDateTimeToUtc(year, month, day, hour, minute)
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

export async function createAppointment(formData: FormData) {
  const supabase = createAdminClient<Database>()

  const organization_id = formData.get("organization_id") as string
  const professional_id = formData.get("professional_id") as string
  const service_id = formData.get("service_id") as string
  const start_time_raw = formData.get("start_time") as string
  const notes = (formData.get("notes") as string) || null

  const payment_method = (formData.get("payment_method") as any) || null
  const payment_status = (formData.get("payment_status") as any) || "pending"

  const is_public_booking = formData.get("source") === "public"

  let customer_id = formData.get("customer_id") as string | null

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

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("duration_minutes, price, title")
    .eq("id", service_id)
    .single()

  if (serviceError || !service) {
    console.error("Erro ao buscar serviço:", serviceError)
    return { error: "Serviço não encontrado." }
  }

  const { data: professional, error: professionalError } = await supabase
    .from("professionals")
    .select("name, phone")
    .eq("id", professional_id)
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
    startTime = parseAppointmentWallTimeToUtc(start_time_raw)
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

  if (finalCustomerPhone) {
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