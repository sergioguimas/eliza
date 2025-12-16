'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPatient(formData: FormData) {
  const supabase = await createClient()

  // 1. Coletar dados
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string

  // 2. Segurança: Identificar a Clínica (Tenant) do usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return { error: 'Perfil sem clínica vinculada' }

  // 3. Salvar Paciente no Banco
  const { error } = await supabase.from('customers').insert({
    name,
    phone,
    email, // opcional
    tenant_id: profile.tenant_id
  })

  if (error) return { error: error.message }

  revalidatePath('/clientes')
  return { success: true }
}