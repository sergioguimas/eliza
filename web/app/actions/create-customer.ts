'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  // Pegando os dados do formulário
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const gender = formData.get('gender') as string
  const notes = formData.get('notes') as string

  // 1. Validar usuário logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Pegar o Tenant ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return { error: 'Perfil inválido' }

  // 3. Salvar no Banco
  const { error } = await supabase.from('customers').insert({
    name,
    email,
    phone,
    gender,
    notes,
    tenant_id: profile.tenant_id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/clientes')
  return { success: true }
}