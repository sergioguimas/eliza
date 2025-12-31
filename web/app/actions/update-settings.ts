'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Verificar se o usuário está autenticado
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Usuário não autenticado." }
  }

  // 2. Coletar os dados do formulário
  const data = {
    name: formData.get("name") as string,
    crm: formData.get("crm") as string,
    document: formData.get("document") as string,
    phone: formData.get("phone") as string,
    email: formData.get("email") as string,
    address: formData.get("address") as string,
  }

  // 3. Verificar se o usuário já possui uma organização vinculada
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  console.log('ID do Usuário:', user.id, 'Org no Banco:', profile?.organization_id);

  try {
    if (!profile?.organization_id) {
      // --- FLUXO DE CRIAÇÃO (Primeiro Acesso / Setup) ---
      
      // A. Criar a nova organização
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert([{ ...data, owner_id: user.id }])
        .select()
        .single()

      if (orgError) throw orgError

      // B. Vincular o perfil do usuário a essa nova organização
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrg.id })
        .eq('id', user.id)

      if (profileUpdateError) throw profileUpdateError

    } else {
      // --- FLUXO DE ATUALIZAÇÃO (Página de Configurações) ---
      const { error: updateError } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', profile.organization_id)

      if (updateError) throw updateError
    }

    // 4. Limpar cache e redirecionar
    revalidatePath('/', 'layout')
    
  } catch (error: any) {
    console.error("Erro ao salvar configurações:", error)
    return { error: error.message || "Ocorreu um erro ao salvar os dados." }
  }

  await supabase.auth.refreshSession(); // Força a atualização da sessão
  revalidatePath('/', 'layout');
  // Se for o fluxo de setup, após salvar ele deve ser liberado pelo middleware
  redirect('/dashboard') 
}