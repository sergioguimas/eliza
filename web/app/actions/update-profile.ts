'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const full_name = formData.get('full_name') as string
  const crm = formData.get('crm') as string
  const specialty = formData.get('specialty') as string

  const { error } = await (supabase.from('profiles') as any)
    .update({
      full_name,
      crm,
      specialty,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: "Erro ao atualizar perfil." }
  }

  revalidatePath('/configuracoes')
  return { success: true }
}