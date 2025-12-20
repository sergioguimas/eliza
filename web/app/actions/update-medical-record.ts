'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateMedicalRecord(recordId: string, content: string) {
  const supabase = await createClient()

  // 1. Tenta atualizar (A RLS do banco garante que só edita se for draft)
  const { error } = await supabase
    .from('medical_records')
    .update({ content })
    .eq('id', recordId)
    // Opcional: Adicionar .eq('status', 'draft') aqui redundante para performance, 
    // mas a RLS é a autoridade final.

  if (error) {
    return { error: "Erro ao atualizar. Verifique se o prontuário já foi assinado." }
  }

  revalidatePath('/clientes')
  return { success: true }
}