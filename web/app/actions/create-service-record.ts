'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient()

  const customerId = formData.get('customerId') as string
  const content = formData.get('content') as string

  // 1. Validar usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Buscar Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id') 
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Perfil inválido ou sem organização' }

  // 3. Salvar na nova tabela service_notes
  const { error } = await supabase.from('service_notes').insert({
    customer_id: customerId,
    content,
    organization_id: profile.organization_id,
    profile_id: user.id,
    status: 'completed'
  })

  if (error) {
    console.error(error)
    return { error: 'Erro ao salvar prontuário' }
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}