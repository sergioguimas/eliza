'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPatient(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string

  // 1. Validar usuário logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Buscar Perfil com organization_id (CORRIGIDO)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id') 
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return { error: 'Perfil sem organização vinculada' }
  }

  // 3. Salvar Paciente no Banco usando organization_id (CORRIGIDO)
  const { error } = await supabase.from('customers').insert({
    name,
    email,
    phone,
    organization_id: profile.organization_id,
  })

  if (error) {
    console.error("Erro ao criar paciente:", error.message)
    return { error: 'Erro ao cadastrar paciente' }
  }

  revalidatePath('/clientes')
  return { success: true }
}