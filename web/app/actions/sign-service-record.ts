'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function signServiceRecord(recordId: string, customerId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await (supabase.from('service_records') as any)
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_by: user.id
    }) 
    .eq('id', recordId)
    .eq('professional_id', user.id) // Garante que só o autor pode assinar

  if (error) {
    console.error('Erro ao assinar:', error)
    return { error: 'Erro ao assinar prontuário. Verifique se você é o autor.' }
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}