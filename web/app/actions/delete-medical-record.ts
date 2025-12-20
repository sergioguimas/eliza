'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteMedicalRecord(recordId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('medical_records')
    .delete()
    .eq('id', recordId)

  if (error) {
    return { error: "Erro ao excluir. Apenas rascunhos podem ser apagados." }
  }

  revalidatePath('/clientes')
  return { success: true }
}