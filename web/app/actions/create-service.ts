'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createService(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const duration = Number(formData.get('duration'))
  const price = Number(formData.get('price'))
  const organizations_id = formData.get('organizations_id') as string

  if (!name || !duration || !price || !organizations_id) {
    return { error: 'Preencha todos os campos obrigatórios' }
  }

  try {
    const { error } = await supabase
      .from('services')
      .insert({
        name,
        duration,
        price,
        organizations_id,
        active: true
      } as any)

    if (error) throw error

    revalidatePath('/procedimentos')
    return { success: true }

  } catch (error: any) {
    console.error('Erro ao criar serviço:', error)
    return { error: error.message || "Erro ao salvar no banco." }
  }
}