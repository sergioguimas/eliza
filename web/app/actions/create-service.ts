'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertService(formData: FormData) {
  const supabase = await createClient()

  const id = formData.get('id') as string
  const title = formData.get('name') as string // O form envia 'name', mas salvamos como 'title'
  const duration_minutes = Number(formData.get('duration'))
  const price = Number(formData.get('price'))
  const color = formData.get('color') as string || '#3b82f6'
  const organization_id = formData.get('organizations_id') as string

  if (!organization_id || organization_id === 'undefined') {
    return { error: "Erro interno: ID da organização não identificado." }
  }

  // Objeto mapeado para o novo Schema
  const serviceData = {
    title,
    duration_minutes,
    price,
    color,
    organization_id,
    is_active: true
  }

  try {
    const { error } = id 
      ? await supabase.from('services').update(serviceData).eq('id', id)
      : await supabase.from('services').insert(serviceData)

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
  
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)

  if (!error) revalidatePath('/procedimentos')
  return { error: error?.message }
}