'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Usuário não autenticado' }
  }

  const org_id = formData.get('org_id') as string
  
  const hasOrgData = formData.has('name') 
  const hasProfileData = formData.has('full_name')

  try {
    // 1. ATUALIZAÇÃO DO PERFIL
    if (hasProfileData) {
      const full_name = formData.get('full_name') as string
      const professional_license = formData.get('crm') as string 

      const { error: profileError } = await (supabase.from('profiles') as any)
        .update({ 
          full_name, 
          professional_license
        })
        .eq('id', user.id)

      if (profileError) throw profileError
    }

    // 2. ATUALIZAÇÃO DA CLÍNICA
    if (hasOrgData && org_id) {
      const name = formData.get('name') as string
      
      if (!name || name.trim() === '') {
        return { error: "O nome da clínica é obrigatório." }
      }

      const niche = formData.get('niche') as string

      const orgUpdateData: any = {
        name
      }

      if (niche) {
        orgUpdateData.niche = niche
      }
      
      const { error: orgError } = await (supabase.from('organizations') as any)
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