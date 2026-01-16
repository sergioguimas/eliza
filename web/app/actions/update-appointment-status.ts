'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Define os status permitidos explicitamente para evitar strings mágicas
const VALID_STATUSES = ['scheduled', 'pending', 'confirmed', 'canceled', 'completed', 'no_show']

export async function updateAppointmentStatus(appointmentId: string, newStatus: string) {
  const supabase = await createClient()

  // 1. Validação Básica
  if (!appointmentId || !newStatus) {
    return { error: "ID e Status são obrigatórios." }
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    return { error: "Status inválido." }
  }

  try {
    // 2. Atualização Segura
    // O RLS do Supabase já garante que o usuário só altere agendamentos da própria org
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)

    if (error) {
      console.error("Erro ao atualizar status:", error)
      return { error: "Falha ao atualizar o status no banco de dados." }
    }

    // 3. Revalidação de Cache
    // Atualiza todas as telas que exibem agendamentos
    revalidatePath('/agendamentos')
    revalidatePath('/dashboard')
    revalidatePath(`/agendamentos/${appointmentId}`)

    return { success: true }

  } catch (err) {
    console.error("Erro inesperado:", err)
    return { error: "Ocorreu um erro interno." }
  }
}