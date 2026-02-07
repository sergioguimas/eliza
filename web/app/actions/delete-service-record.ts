'use server'

import { createClient } from '@/utils/supabase/server'
import { Database } from "@/utils/database.types"

export async function deleteServiceRecord(recordId: string) {
  const supabase = await createClient<Database>()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('service_records')
    .delete()
    .eq('id', recordId)
    .eq('professional_id', user.id)

  if (error) {
    console.error('Erro ao excluir:', error)
    return { error: 'Erro ao excluir anotação.' }
  }

  return { success: true }
}