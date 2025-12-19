'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createService(formData: FormData) {
  const supabase = await createClient()

  const title = formData.get('title') as string
  const price = parseFloat(formData.get('price') as string)
  const duration = parseInt(formData.get('duration') as string)
  const color = formData.get('color') as string // <--- Pegando a cor

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return { error: 'Erro de perfil' }

  const { error } = await supabase.from('services').insert({
    title,
    price,
    duration_minutes: duration,
    color, // <--- Salvando a cor
    tenant_id: profile.tenant_id,
    is_active: true
  })

  if (error) return { error: error.message }

  revalidatePath('/servicos')
  revalidatePath('/agendamentos')
  return { success: true }
}