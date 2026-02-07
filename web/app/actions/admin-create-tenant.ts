'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { Database } from "@/utils/database.types"

export async function createTenant(formData: FormData) {
  // 1. Configurações
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const godEmail = process.env.NEXT_PUBLIC_GOD_EMAIL
  
  if (!serviceRoleKey || !supabaseUrl) return { error: 'Erro de configuração interna.' }

  // 2. Cliente Admin
  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 3. Segurança (Só God Mode pode criar)
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.email !== godEmail) {
    return { error: 'Não autorizado.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const tenantName = formData.get('orgName') as string
  
  if (!email || !password) return { error: 'Email e Senha são obrigatórios' }

  try {
    // 4. CRIAR APENAS O USUÁRIO (O Trigger do banco cria o Profile)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Admin ${tenantName}` }
    })

    if (authError) throw authError
    if (!authUser.user) throw new Error("Falha ao criar usuário")

    return { success: true, message: `Login criado! O usuário ${email} pode acessar e configurar a empresa.` }

  } catch (error: any) {
    console.error('Erro:', error)
    return { error: error.message || 'Erro ao criar usuário.' }
  }
}