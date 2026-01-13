'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

// Usamos o admin client diretamente
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function createTenant(formData: FormData) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const godEmail = process.env.GOD_EMAIL
  
  // 1. Segurança: Se não for você, tchau.
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
    // 1. Criar Usuário
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Admin ${orgName}` }
    })

    if (authError) throw authError
    if (!authUser.user) throw new Error("Falha ao criar usuário Auth")

    // 2. Criar Organização
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

    // 3. Vincular (CORREÇÃO: UPSERT em vez de UPDATE)
    // Isso resolve a Race Condition. Se o trigger ainda não rodou, nós criamos o perfil agora.
    // Se o trigger já rodou, nós atualizamos.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id, // O ID do Auth é a chave
        organization_id: org.id,
        role: 'owner',
        full_name: `Admin ${orgName}`,
        // Campos opcionais que o trigger preencheria, garantimos aqui:
        created_at: new Date().toISOString() 
      })

    if (profileError) throw profileError

    return { success: true, message: `Cliente criado! Login: ${email}` }

  } catch (error: any) {
    console.error('Erro ao criar tenant:', error)
    return { error: error.message }
  }
}