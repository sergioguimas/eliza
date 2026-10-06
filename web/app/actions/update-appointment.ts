'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from 'next/cache'
import { Database } from "@/utils/database.types"
import { editarAgendamento } from "@/lib/domain/agendamentos"
import { DomainError } from "@/lib/domain/erros"
import { horaLocalParaUtc } from "@/lib/domain/tempo"
import { atorDoPainel, organizacaoDaSessao } from "@/lib/painel-sessao"

export async function updateAppointment(formData: FormData) {
  const appointmentId =
    (formData.get('appointment_id') as string) || (formData.get('id') as string)
  const dateRaw = formData.get('date') as string
  const timeRaw = formData.get('time') as string
  const professionalId = formData.get('professional_id') as string
  const serviceId = formData.get('service_id') as string
  const notes = (formData.get('notes') as string) || null

  if (!appointmentId || !dateRaw || !timeRaw) {
    return { error: "Dados incompletos para atualizar o agendamento." }
  }

  // A org vem do perfil da sessão, nunca do form: o domínio roda em service role.
  const sessao = await organizacaoDaSessao()

  if ("error" in sessao) return { error: sessao.error }

  let newStartTime: Date

  try {
    newStartTime = horaLocalParaUtc(`${dateRaw}T${timeRaw}:00`)
  } catch {
    return { error: "Horário do agendamento inválido." }
  }

  try {
    await editarAgendamento(
      createAdminClient<Database>(),
      atorDoPainel(sessao.organizationId, true),
      appointmentId,
      {
        inicio: newStartTime,
        // Vazio = mantém o atual (o form manda "" quando o select não foi tocado).
        profissionalId: professionalId || undefined,
        servicoId: serviceId || undefined,
        observacao: notes,
      }
    )
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message }

    console.error("Erro ao atualizar agendamento:", error)
    return { error: 'Erro ao atualizar agendamento' }
  }

  revalidatePath('/agendamentos')
  revalidatePath('/')
  return { success: true }
}
