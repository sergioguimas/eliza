'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient<Database>()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado' }
  }

  // Identifica EXPLICITAMENTE qual formulário está enviando
  const form_type = formData.get('form_type') as string

  try {
    // --- CASO 1: ATUALIZAR PERFIL ---
    if (form_type === 'profile') {
      const full_name = formData.get('full_name') as string
      const professional_license = formData.get('crm') as string 

      const { error: profileError } = await (supabase.from('profiles'))
        .update({ 
          full_name, 
          professional_license 
        })
        .eq('id', user.id)

      if (profileError) throw profileError
    }

    // --- CASO 2: ATUALIZAR CLÍNICA ---
    else if (form_type === 'organization') {
      const org_id = formData.get('org_id') as string
      const name = formData.get('name') as string
      
      if (!org_id) return { error: "ID da organização não encontrado" }
      if (!name || name.trim() === '') return { error: "O nome da clínica é obrigatório." }

      // Se tiver nicho no form, adiciona (mantendo compatibilidade)
      const niche = formData.get('niche') as string
      const orgUpdateData: any = { name }
      if (niche) orgUpdateData.niche = niche
      
      const { error: orgError } = await (supabase.from('organizations'))
        .update(orgUpdateData)
        .eq('id', org_id)
        
      if (orgError) throw orgError
    }

    revalidatePath('/configuracoes')
    revalidatePath('/setup')
    
    return { success: true }
    
  } catch (error: any) {
    console.error("Erro no updateSettings:", error)
    return { error: 'Erro ao salvar: ' + (error.message || "Erro desconhecido") }
  }
}