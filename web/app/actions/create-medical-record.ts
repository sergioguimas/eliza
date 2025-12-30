'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createMedicalRecord(formData: FormData) {
  const supabase = await createClient()

  const customerId = formData.get('customerId') as string
  const content = formData.get('content') as string

  // 1. Validar usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Buscar Perfil (Mudança aqui: organization_id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id') 
    .eq('id', user.id)
    .single()

  // CORREÇÃO: Usar organization_id
  if (!profile?.organization_id) return { error: 'Perfil inválido ou sem organização' }

  // 3. Salvar (Mudança aqui: organization_id e staff_id)
  const { error } = await supabase.from('medical_records').insert({
    customer_id: customerId,
    content,
    organization_id: profile.organization_id, // <--- Aqui
    staff_id: user.id, // <--- O prontuário pertence a quem criou
    status: 'completed'
  })

  if (error) {
    console.error(error)
    return { error: 'Erro ao salvar prontuário' }
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}