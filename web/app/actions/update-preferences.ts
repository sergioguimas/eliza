'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

type OrganizationSettingsUpdate =
  Database["public"]["Tables"]["organization_settings"]["Update"]

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient<Database>()

  const organization_id = formData.get("organizationId") as string
  const form_type = formData.get("form_type") as string

  if (!organization_id) {
    return { error: "Organização não informada." }
  }

  if (form_type === "schedule") {
    const duration = Number(formData.get("appointment_duration"))

    if (!Number.isFinite(duration) || duration <= 0) {
      return { error: "Duração do atendimento inválida." }
    }

    const updates: OrganizationSettingsUpdate = {
      open_hours_start: formData.get("open_hours_start") as string,
      open_hours_end: formData.get("open_hours_end") as string,
      lunch_start: formData.get("lunch_start") as string,
      lunch_end: formData.get("lunch_end") as string,
      appointment_duration: duration,
      days_of_week: formData
        .getAll("days_of_week")
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d)),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("organization_settings")
      .upsert(
        {
          organization_id,
          ...updates,
        },
        {
          onConflict: "organization_id",
        }
      )

    if (error) {
      console.error("[updatePreferences:schedule]", error)
      return { error: "Erro ao salvar horários." }
    }
  } else if (form_type === "messages") {
    const updates: OrganizationSettingsUpdate = {
      msg_appointment_pending: formData.get("msg_appointment_pending") as string,
      msg_appointment_created: formData.get("msg_appointment_created") as string,
      msg_appointment_reminder: formData.get("msg_appointment_reminder") as string,
      msg_appointment_canceled: formData.get("msg_appointment_canceled") as string,
      msg_doctor_daily_summary: formData.get("msg_doctor_daily_summary") as string,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("organization_settings")
      .upsert(
        {
          organization_id,
          ...updates,
        },
        {
          onConflict: "organization_id",
        }
      )

    if (error) {
      console.error("[updatePreferences:messages]", error)
      return { error: "Erro ao salvar mensagens." }
    }
  } else {
    return { error: "Tipo de formulário inválido." }
  }

  revalidatePath("/configuracoes")
  return { success: true }
}