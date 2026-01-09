'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'

// Usamos o admin client diretamente aqui para ter permissão de criar usuários
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
  // 1. Verificação de Segurança
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const MY_EMAIL = 'seu-email-admin@exemplo.com' 
  
  if (!user || user.email !== MY_EMAIL) {
    return { error: 'Não autorizado. Apenas o admin pode criar tenants.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = formData.get('orgName') as string
  
  if (!email || !password || !orgName) {
    return { error: 'Preencha todos os campos' }
  }

  try {
    // 2. Criar o Usuário no Auth (Email já confirmado)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Já cria confirmado, sem precisar de email de verificação
      user_metadata: { full_name: 'Admin da Clínica' } // Gatilho inicial
    })

    if (authError) throw authError

    if (!authUser.user) throw new Error("Falha ao criar usuário Auth")

    // 3. Criar a Organização
    // Como estamos usando a Service Role, podemos inserir direto no banco
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substring(2, 7)
    
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: orgName,
        slug: slug,
        subscription_status: 'active'
      })
      .select()
      .single()

    if (orgError) throw orgError

    // 4. Atualizar o Profile do usuário para ser DONO dessa nova organização
    // A trigger 'handle_new_user' já deve ter rodado e criado o profile, 
    // então vamos fazer um UPDATE.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        organization_id: org.id,
        role: 'owner',
        full_name: `Admin ${orgName}`
      })
      .eq('id', authUser.user.id)

    if (profileError) throw profileError

    return { success: true, message: `Cliente criado! Email: ${email}, Senha: ${password}` }

  } catch (error: any) {
    console.error('Erro ao criar tenant:', error)
    return { error: error.message }
  }
}