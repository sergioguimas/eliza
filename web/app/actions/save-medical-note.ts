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

  // BUSCA O ORGANIZATIONS_ID DO CLIENTE PARA GARANTIR O VÍNCULO CORRETO
  const { data: customer } = await supabase
    .from('customers')
    .select('organizations_id')
    .eq('id', customer_id)
    .single() as any

  if (!customer?.organizations_id) {
    return { error: "Erro de permissão: Organização não encontrada para este cliente." }
  }

  const { error } = await supabase
    .from('medical_records')
    .insert({
      customer_id,
      content,
      organizations_id: customer.organizations_id
    } as any)

  if (error) {
    return { error: "Erro ao salvar: " + error.message }
  }

  revalidatePath(`/clientes/${customer_id}`)
  return { success: true }
}