'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js' // Importamos o cliente JS puro para modo Admin
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}

export async function signup(formData: FormData) {
  // 1. Cliente Normal (para criar o login Auth)
  const supabase = await createClient()
  
  // 2. Cliente Admin (para criar os dados no banco sem travas de segurança)
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  // --- A. Criar Usuário Auth (Usando cliente normal) ---
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) return { error: authError.message }
  if (!authData.user) return { error: "Erro ao criar usuário" }

  // --- B. Criar Tenant (Usando ADMIN para garantir permissão) ---
  const tenantName = `${name}'s Business`
  const tenantSlug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000)

  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({ name: tenantName, slug: tenantSlug })
    .select()
    .single()

  if (tenantError) return { error: "Erro ao criar empresa: " + tenantError.message }

  // --- C. Criar Perfil (Usando ADMIN) ---
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authData.user.id, // ID do usuário que acabamos de criar
      full_name: name,
      tenant_id: tenant.id,
      role: 'owner'
    })

  if (profileError) return { error: "Erro ao criar perfil: " + profileError.message }

  redirect('/')
}