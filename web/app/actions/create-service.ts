'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertService(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const duration = Number(formData.get('duration'))
  const price = Number(formData.get('price'))
  const color = formData.get('color') as string || '#3b82f6'
  const organizations_id = formData.get('organizations_id') as string

  // Objeto mapeado exatamente como a tabela física
  const serviceData = {
    name,
    duration,
    price,
    color,
    organizations_id,
    active: true
  }

  try {
    const { error } = id 
      ? await supabase.from('services').update(serviceData as any).eq('id', id)
      : await supabase.from('services').insert(serviceData as any)

    if (error) throw error

    revalidatePath('/procedimentos')
    revalidatePath('/agendamentos')
    return { success: true }
  } catch (error: any) {
    console.error("Erro no banco:", error)
    return { error: error.message }
  }
}

export async function deleteService(id: string) {
  const supabase = await createClient()
  
  // O 'as any' ajuda se houver conflito de tipagem no delete
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (!error) revalidatePath('/procedimentos')
  return { error: error?.message }
}