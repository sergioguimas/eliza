'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateAppointmentPayment(appointmentId: string, method?: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('appointments')
    .update({ 
      payment_status: 'paid',
      paid_at: new Date().toISOString(), 
      payment_method: method || 'Outros'
    })
    .eq('id', appointmentId)

  if (error) {
    console.error("Erro ao baixar pagamento:", error)
    return { error: "Falha ao processar pagamento." }
  }

  revalidatePath('/dashboard/financas')
  revalidatePath('/dashboard/agenda')
  revalidatePath('/dashboard')
  return { success: true }
}