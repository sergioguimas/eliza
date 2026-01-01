'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: "Usuário não autenticado." }

  // Coleta dados da Organização e do Perfil
  const data = {
    name: formData.get("name") as string,
    crm: formData.get("crm") as string,
    document: formData.get("document") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string,
    address: formData.get("address") as string,
    evolution_url: formData.get("evolution_url") as string,
    evolution_apikey: formData.get("evolution_apikey") as string,
  }

  // E colete o nome do perfil separadamente:
  const full_name = formData.get("full_name") as string

  // Busca o perfil atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  try {
    let currentOrgId = profile?.organizations_id

    if (!currentOrgId) {
      // --- SETUP INICIAL ---
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert([{ ...data, owner_id: user.id }])
        .select()
        .single()

      if (orgError) throw orgError
      currentOrgId = newOrg.id

      // Vincula a organização e atualiza o nome do perfil
      const { error: profError } = await supabase
        .from('profiles')
        .update({ organizations_id: currentOrgId, full_name })
        .eq('id', user.id)

      if (profError) throw profError
    } else {
      // --- ATUALIZAÇÃO DE CONFIGURAÇÕES ---
      const { error: orgUpdateError } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', currentOrgId)

      if (orgUpdateError) throw orgUpdateError

      const { error: profUpdateError } = await supabase
        .from('profiles')
        .update({ full_name })
        .eq('id', user.id)

      if (profUpdateError) throw profUpdateError
    }

    revalidatePath('/', 'layout')
    revalidatePath('/dashboard')
    revalidatePath('/configuracoes')
    
  } catch (error: any) {
    console.error("Erro ao salvar:", error)
    return { error: error.message }
  }

  // Se for o primeiro setup, o redirect é necessário
  // Se for apenas atualização, o revalidatePath já cuida da UI
  if (!profile?.organizations_id) {
    redirect('/dashboard')
  }
  
  return { success: true }
}