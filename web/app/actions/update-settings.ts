'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()

  // 1. Validar Usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const orgId = formData.get('org_id') as string
  const userId = formData.get('user_id') as string

  // 2. Dados da Organização (Clínica)
  const orgData = {
    name: formData.get('name') as string,
    document: formData.get('document') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    address: formData.get('address') as string,
    evolution_api_url: formData.get('evolution_url') as string,
    evolution_api_key: formData.get('evolution_apikey') as string,
  }

  // 3. Dados do Perfil (Médico)
  const profileData = {
    full_name: formData.get('full_name') as string,
    crm: formData.get('crm') as string,
  }

  try {
    // Atualiza Organização
    if (orgId) {
      const { error: orgError } = await supabase
        .from('organizations')
        .update(orgData)
        .eq('id', orgId)

      if (orgError) {
        console.error('Erro Update Org:', orgError)
        return { error: 'Erro ao atualizar dados da clínica.' }
      }
    }

    // Atualiza Perfil
    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)

      if (profileError) {
        console.error('Erro Update Profile:', profileError)
        return { error: 'Erro ao atualizar dados do perfil.' }
      }
    }

    revalidatePath('/configuracoes')
    return { success: true }

  } catch (error: any) {
    console.error('Erro Geral:', error)
    return { error: error.message }
  }
}