'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createService(formData: FormData) {
  const supabase = await createClient()

  // 1. Coletar dados do formulário
  const title = formData.get('title') as string
  const duration = parseInt(formData.get('duration') as string)
  const price = parseFloat(formData.get('price') as string)

  // 2. Pegar o tenant_id do usuário logado (Segurança Multi-tenant)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Usuário não autenticado' }

  // Busca o perfil para saber qual tenant ele pertence
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return { error: 'Usuário sem empresa vinculada' }

  // 3. Inserir no banco
  const { error } = await supabase.from('services').insert({
    title,
    duration_minutes: duration,
    price,
    tenant_id: profile.tenant_id
  })

  if (error) return { error: error.message }

  // 4. Atualizar a tela sem refresh
  revalidatePath('/')
  return { success: true }
}