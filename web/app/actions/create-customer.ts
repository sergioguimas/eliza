'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  const full_name = formData.get('full_name') as string
  const phone = formData.get('phone') as string
  const document = formData.get('document') as string
  const organizations_id = formData.get('organizations_id') as string

  if (!full_name || !organizations_id) {
    return { error: 'O nome completo é obrigatório.' }
  }

  try {
    const { error } = await supabase
      .from('customers')
      .insert({
        full_name,
        phone,
        document,
        organizations_id
      } as any)

    if (error) throw error

    revalidatePath('/clientes')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}