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
  
  const hasOrgData = formData.has('name') // Se tem 'name', é update de Clínica
  const hasProfileData = formData.has('full_name') // Se tem 'full_name', é update de Perfil

  try {
    // 1. ATUALIZAÇÃO DO PERFIL (Só roda se vier do form de Perfil)
    if (hasProfileData) {
      const full_name = formData.get('full_name') as string
      const crm = formData.get('crm') as string

      const { error: profileError } = await (supabase.from('profiles') as any)
        .update({ 
          full_name, 
          crm 
        })
        .eq('id', user.id)

      if (profileError) throw profileError
    }

    // 2. ATUALIZAÇÃO DA CLÍNICA (Só roda se vier do form de Clínica)
    if (hasOrgData && org_id) {
      const name = formData.get('name') as string
      
      // Validação de Segurança: Nunca tente salvar nome vazio ou null
      if (!name || name.trim() === '') {
        return { error: "O nome da clínica é obrigatório." }
      }

      const document = formData.get('document') as string
      const phone = formData.get('phone') as string
      const email = formData.get('email') as string
      const address = formData.get('address') as string
      const niche = formData.get('niche') as string

      // Monta o objeto de update dinamicamente
      const orgUpdateData: any = {
        name,
        document,
        phone,
        email,
        address
      }

      // Só atualiza nicho se ele foi enviado (para não apagar se não estiver no form)
      if (niche) {
        orgUpdateData.niche = niche
      }

      // Lógica de Onboarding (se preencheu nome e telefone, considera completo)
      if (name && phone) {
        orgUpdateData.onboarding_completed = true
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