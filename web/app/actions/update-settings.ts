'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()

  // 1. Segurança: Pega o ID direto da sessão (Infalível)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Sanitização dos IDs
  let orgId = formData.get('org_id') as string
  if (orgId === 'undefined' || orgId === 'null') orgId = ''

  // 3. Coleta dos Dados
  const orgData = {
    name: formData.get('name') as string,
    document: formData.get('document') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    address: formData.get('address') as string,
    evolution_api_url: formData.get('evolution_url') as string,
    evolution_api_key: formData.get('evolution_apikey') as string,
  }

  const profileData = {
    full_name: formData.get('full_name') as string,
    crm: formData.get('crm') as string,
  }

  try {
    // === CENÁRIO A: ATUALIZAR CLÍNICA EXISTENTE ===
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
    // === CENÁRIO B: CRIAR NOVA CLÍNICA (Primeiro Acesso) ===
    else if (orgData.name) {
      // Gera slug simples
      const slug = orgData.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
      
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          ...orgData,
          slug,
          // owner_id não existe mais na tabela, o vínculo é pelo profile
        })
        .select()
        .single()

      if (createError) {
        console.error('Erro Create Org:', createError)
        return { error: 'Erro ao criar organização.' }
      }

      // Define o ID recém criado para vincular no perfil abaixo
      orgId = newOrg.id
    }

    // === ATUALIZAÇÃO DO PERFIL (MÉDICO) ===
    // Aqui usamos user.id (seguro) em vez do que vem do form
    
    // Prepara dados do perfil
    const updates: any = { ...profileData }
    
    // Se acabamos de criar/descobrir a org, vincula o médico a ela e torna dono
    if (orgId) {
      updates.organization_id = orgId
      
      // Verifica se o usuário já tem role, se não, vira Owner da nova org
      const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!currentProfile?.role) {
        updates.role = 'owner'
      }
    }

    // Usa UPSERT para garantir que funciona mesmo se o perfil não existir
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...updates
      })

    if (profileError) {
      console.error('Erro Update Profile:', profileError)
      return { error: 'Erro ao atualizar perfil.' }
    }

    revalidatePath('/configuracoes')
    revalidatePath('/setup')
    return { success: true }

  } catch (error: any) {
    console.error('Erro Geral:', error)
    return { error: error.message }
  }
}