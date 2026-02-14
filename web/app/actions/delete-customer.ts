'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient<Database>()

  const { error } = await supabase
    .from('customers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', customerId)

  if (error) return { error: "Erro ao desativar cliente." }

  revalidatePath('/clientes')
  return { success: true }
}