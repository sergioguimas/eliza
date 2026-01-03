'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleServiceStatus(serviceId: string, currentStatus: boolean) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !currentStatus })
      .eq('id', serviceId)

    if (error) throw error

    revalidatePath('/procedimentos')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao alterar status:', error)
    return { error: error.message }
  }
}