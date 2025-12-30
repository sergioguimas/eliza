'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const gender = formData.get('gender') as string
  const notes = formData.get('notes') as string

  // 1. Validar usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Pegar Organization ID (Correção aqui!)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id') 
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Perfil sem organização vinculada' }

  // 3. Salvar no Banco
  const { error } = await supabase.from('customers').insert({
    name,
    email,
    phone,
    gender,
    notes,
    organization_id: profile.organization_id, // <--- CAMPO CORRETO
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { success: true }
}