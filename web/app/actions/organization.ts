'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autorizado')

  const name = formData.get('name') as string

  // 1. Criar a organização
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, owner_id: user.id })
    .select()
    .single()

  if (orgError) return { error: orgError.message }

  // 2. Vincular o usuário a essa organização no perfil dele
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ organization_id: org.id })
    .eq('id', user.id)

  if (profileError) return { error: profileError.message }

  // 3. Agora que ele tem empresa, o Middleware vai permitir o acesso ao Dashboard
  redirect('/dashboard')
}