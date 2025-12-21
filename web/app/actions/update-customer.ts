'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateCustomer(customerId: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const gender = formData.get('gender') as string
  const notes = formData.get('notes') as string

  // A RLS do banco já garante que só edito se for do meu tenant
  const { error } = await supabase
    .from('customers')
    .update({
      name,
      email,
      phone,
      gender,
      notes,
    })
    .eq('id', customerId)

  if (error) {
    return { error: "Erro ao atualizar paciente." }
  }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${customerId}`) // Atualiza também a página de perfil
  return { success: true }
}