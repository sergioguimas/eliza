'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { sendAppointmentCancellation } from "./whatsapp-messages"
import { Database } from "@/utils/database.types"

export async function cancelAppointment(appointmentId: string) {
  const supabase = await createClient<Database>()

  const { error } = await (supabase.from('appointments'))
    .update({ status: 'canceled' })
    .eq('id', appointmentId)

  if (error) {
    console.error("Erro ao cancelar:", error)
    return { error: error.message }
  }

  // Tenta enviar a mensagem (sem travar se falhar)
  try {
    if (sendAppointmentCancellation) {
        sendAppointmentCancellation(appointmentId).catch(err => 
            console.error("Falha background whatsapp:", err)
        )
    }
  } catch (e) {
    console.error("Erro ao tentar enviar WPP", e)
  }

  revalidatePath('/agendamentos')
  revalidatePath('/dashboard')
  revalidatePath('/')
  
  return { success: true }
}