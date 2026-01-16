'use server'

import { createClient } from '@/utils/supabase/server'

export async function updateServiceRecord(recordId: string, content: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('service_notes')
    .update({ content })
    .eq('id', recordId)
    .eq('profile_id', user.id)

  if (error) {
    console.error('Erro ao atualizar:', error)
    return { error: 'Erro ao salvar alterações.' }
  }

  return { success: true }
}