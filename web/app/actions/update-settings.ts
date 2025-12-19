'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()

  const clinicName = formData.get('clinicName') as string

  // 1. Pegar usuário atual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // 2. Descobrir qual é o Tenant (Clínica) desse usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return { error: 'Perfil inválido' }

  // 3. Atualizar o nome da Clínica na tabela tenants
  const { error } = await supabase
    .from('tenants')
    .update({ name: clinicName })
    .eq('id', profile.tenant_id)

  if (error) return { error: error.message }

  revalidatePath('/configuracoes')
  revalidatePath('/', 'layout')
  return { success: true }
}