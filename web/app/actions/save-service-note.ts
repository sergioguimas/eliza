'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveServiceNote(formData: FormData) {
  const supabase = await createClient()

  const customer_id = formData.get('customer_id') as string
  const content = formData.get('content') as string

  if (!content || content.trim().length < 3) {
    return { error: "O prontuário está muito curto para ser salvo." }
  }

  // BUSCA O organization_id DO CLIENTE PARA GARANTIR O VÍNCULO CORRETO
  const { data: customer } = await supabase
    .from('customers')
    .select('organization_id')
    .eq('id', customer_id)
    .single() as any

  if (!customer?.organization_id) {
    return { error: "Erro de permissão: Organização não encontrada para este cliente." }
  }

  const { error } = await supabase
    .from('service_records')
    .insert({
      customer_id,
      content,
      organization_id: customer.organization_id
    } as any)

  if (error) {
    return { error: "Erro ao salvar: " + error.message }
  }

  revalidatePath(`/clientes/${customer_id}`)
  return { success: true }
}