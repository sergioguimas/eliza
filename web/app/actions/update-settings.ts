'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()

  // 1. Pegar o usuário logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }

  // 2. Descobrir qual é o Tenant (Clínica) desse usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: "Perfil não encontrado" }

  // 3. Pegar os dados do formulário
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const crm = formData.get('crm') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string
  const address = formData.get('address') as string

  // 4. Atualizar a tabela organizations
  const { error } = await supabase
    .from('organizations')
    .update({
      name,
      document,
      crm,
      email,
      phone,
      address,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.organization_id)

  if (error) {
    console.error('Erro ao atualizar:', error)
    return { error: "Erro ao atualizar configurações." }
  }

  revalidatePath('/configuracoes')
  revalidatePath('/')
  
  return { success: true }
}