'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

export async function updateCustomer(formData: FormData) {
  const supabase = await createClient<Database>()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const document = formData.get('document') as string
  const email = formData.get('email') as string
  const address = formData.get('address') as string
  const notes = formData.get('notes') as string
  const birth_date = formData.get('birth_date') as string
  const active = formData.get('active') === 'on'

  const dataToUpdate: any = {
    name,
    phone,
    document,
    email: email || null,
    address: address || null,
    notes: notes || null,
    active: active
  }

  if (birth_date) {
    dataToUpdate.birth_date = birth_date
  } else {
    dataToUpdate.birth_date = null
  }

  const { error } = await (supabase.from('customers'))
    .update(dataToUpdate)
    .eq('id', id)

  if (error) {
    console.error(error)
    return { error: "Erro ao atualizar cliente" }
  }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  return { success: true }
}