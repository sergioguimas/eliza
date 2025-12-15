'use server'

import { createClient } from '@/utils/supabase/server'
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

  // Se der certo, redireciona para o dashboard (vamos criar essa página depois)
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  // 1. Criar Usuário Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) return { error: authError.message }
  if (!authData.user) return { error: "Erro ao criar usuário" }

  // 2. Criar Tenant (Empresa) automaticamente
  // Todo usuário novo ganha um "Tenant" próprio neste MVP
  const tenantName = `${name}'s Business`
  const tenantSlug = name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 1000)

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({ name: tenantName, slug: tenantSlug })
    .select()
    .single()

  if (tenantError) return { error: "Erro ao criar empresa: " + tenantError.message }

  // 3. Criar Perfil vinculado
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: name,
      tenant_id: tenant.id,
      role: 'owner'
    })

  if (profileError) return { error: "Erro ao criar perfil: " + profileError.message }

  redirect('/')
}