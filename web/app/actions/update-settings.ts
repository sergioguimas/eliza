'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()

  // Captura os dados
  const org_id = formData.get('org_id') as string
  const name = formData.get('name') as string
  const document = formData.get('document') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const address = formData.get('address') as string
  
  // NOVO CAMPO: NICHO
  const niche = formData.get('niche') as string 

  // Validação Básica
  if (!org_id) {
    return { error: "ID da organização não encontrado." }
  }

  // Se veio full_name ou crm, é atualização de perfil (não mexemos aqui na org)
  const full_name = formData.get('full_name') as string
  const crm = formData.get('crm') as string

  try {
    // 1. Atualiza Perfil (Se houver dados)
    if (full_name || crm) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ full_name, crm }).eq('id', user.id)
      }
    }

    // 2. Atualiza Organização (Se houver dados)
    // Se o nicho vier vazio (ex: edição posterior), não sobrescreve com null
    const orgUpdateData: any = { name, document, phone, email, address }
    
    if (niche) {
      orgUpdateData.niche = niche
    }

    // Detecta se é o setup inicial (se todos os campos essenciais estão preenchidos)
    if (name && phone) {
      orgUpdateData.onboarding_completed = true
    }

    const { error } = await supabase
      .from('organizations')
      .update(orgUpdateData)
      .eq('id', org_id)

    if (error) {
      console.error(error)
      return { error: "Erro ao atualizar dados da empresa." }
    }

    revalidatePath('/configuracoes')
    revalidatePath('/setup')
    
    return { success: true }
    
  } catch (err) {
    return { error: "Erro interno no servidor." }
  }
}