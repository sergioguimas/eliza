'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

export async function createTenant(formData: FormData) {
  // 1. Verificação de Ambiente (Fail Fast)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const godEmail = process.env.NEXT_PUBLIC_GOD_EMAIL
  if (!serviceRoleKey || !supabaseUrl) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase ausentes no servidor.")
    return { error: 'Erro interno de configuração do servidor (Service Role Key).' }
  }

  // 2. Cria o cliente Admin do Supabase
  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // 3. Segurança: Se não for você, tchau.
  if (!user || user.email !== godEmail) {
    return { error: 'Não autorizado.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = formData.get('orgName') as string
  
  if (!email || !password || !orgName) {
    return { error: 'Preencha todos os campos' }
  }

  try {
    // 4. Criar Usuário
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Admin ${orgName}` }
    })

    if (authError) throw authError
    if (!authUser.user) throw new Error("Falha ao criar usuário Auth")

    // 5. Criar Organização
    // Gera um slug único simples
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
    
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName,
        slug: slug,
        subscription_status: 'active',
        onboarding_completed: false // Garante que comece falso
      })
      .select()
      .single()

    if (orgError) throw orgError

    // 6. Vincular (UPSERT para evitar Race Conditions de Triggers)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id, // O ID do Auth é a chave
        organization_id: org.id,
        role: 'owner',
        full_name: `Admin ${orgName}`,
        created_at: new Date().toISOString() 
      })

    if (profileError) throw profileError

    return { success: true, message: `Cliente criado! Login: ${email}` }

  } catch (error: any) {
    console.error('Erro ao criar tenant:', error)
    return { error: error.message || 'Erro desconhecido ao criar organização.' }
  }
}