'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveMedicalNote(formData: FormData) {
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  const content = formData.get('content') as string

  if (!content || content.trim().length < 3) {
    return { error: "O prontuário está muito curto para ser salvo." }
  }

  const { error } = await supabase
    .from('medical_records')
    .insert({
      customer_id,
      content,
    } as any)

  if (error) {
    return { error: "Erro ao salvar: " + error.message }
  }

  revalidatePath(`/clientes/${customer_id}`)
  return { success: true }
}