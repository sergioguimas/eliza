'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from "@/utils/database.types"

export async function upsertService(formData: FormData) {
  const supabase = await createClient<Database>()

  const id = formData.get('id') as string
  const title = formData.get('name') as string
  const duration_minutes = Number(formData.get('duration'))
  const price = Number(formData.get('price'))
  
  const color = formData.get('color') as string || '#3b82f6'
  
  const organization_id = formData.get('organization_id') as string

  if (!organization_id || organization_id === 'undefined') {
    return { error: "Erro interno: ID da organização não identificado." }
  }

  const serviceData = {
    title,
    duration_minutes,
    price,
    color,
    organization_id,
    active: true 
  }

  try {
    const { error } = id 
      ? await (supabase.from('services')).update(serviceData).eq('id', id)
      : await (supabase.from('services')).insert(serviceData)

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
  const supabase = await createClient<Database>()
  
  const { error } = await (supabase.from('services'))
    .delete()
    .eq('id', id)

  if (!error) revalidatePath('/procedimentos')
  return { error: error?.message }
}