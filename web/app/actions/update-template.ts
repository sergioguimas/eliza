'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateMessageTemplate(id: string, content: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('message_templates')
    .update({ content })
    .eq('id', id)

  if (error) {
    throw new Error('Erro ao atualizar template')
  }

  revalidatePath('/configuracoes')
  return { success: true }
}