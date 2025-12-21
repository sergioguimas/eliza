'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)

  if (error) {
    return { error: "Erro ao excluir. Verifique se o paciente possui agendamentos ativos." }
  }

  revalidatePath('/clientes')
  return { success: true }
}