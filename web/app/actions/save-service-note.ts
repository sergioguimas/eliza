'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from "@/utils/database.types"

export async function saveServiceNote(
  customerId: string, 
  content: string, 
  organizationId: string,
  tags: string[] = []
) {const supabase = await createClient<Database>()

  if (!content || content.trim().length < 3) {
    return { error: "O prontuário está muito curto para ser salvo." }
  }

  const { data: {user} } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Usuário não autenticado." }
  }

  const { error } = await supabase
    .from('service_records')
    .insert({
      customer_id: customerId,
      organization_id: organizationId,
      content,
      tags: tags,
      profile_id: user?.id,
      date: new Date().toISOString(),
    })

  if (error) {
    console.error("Error saving service note:", error)
    return { error: "Falha ao salvar a nota" }
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}