'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertCustomer(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string 
  const name = formData.get('full_name') as string // Form envia full_name
  const phone = formData.get('phone') as string
  const document = formData.get('document') as string
  const organization_id = formData.get('organizations_id') as string

  const customerData = {
    name,
    phone,
    document,
    organization_id
  }

  try {
    const { error } = id 
      ? await supabase.from('customers').update(customerData).eq('id', id)
      : await supabase.from('customers').insert(customerData)

    if (error) throw error

    revalidatePath('/clientes')
    if (id) revalidatePath(`/clientes/${id}`)
    
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}