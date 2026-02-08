'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Database } from "@/utils/database.types"

function getRedirectUrl(formData: FormData, defaultUrl: string) {
  const next = formData.get('redirectTo') as string
  if (next && next.startsWith('/')) { 
    return next
  }
  return defaultUrl
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = getRedirectUrl(formData, '/dashboard')
  
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect(redirectTo)
}

export async function signUp(formData: FormData) {
  const headersList = await headers() 
  const origin = headersList.get('origin')
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const redirectTo = getRedirectUrl(formData, '/setup')

  const supabase = await createClient<Database>()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    redirect(redirectTo)
  }

  return { success: 'Verifique seu email para confirmar o cadastro.' }
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient<Database>() 
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const companyName = formData.get('companyName') as string
  
  const slug = companyName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 10000)

  const { data: org, error: orgError } = await supabase
    .from('organizations') 
    .insert({
      name: companyName,
      slug: slug,
      niche: 'generico', // Padrão
      plan: 'free',
      subscription_status: 'active'
    })
    .select()
    .single()

  if (orgError) {
    console.error('Erro ao criar organização:', orgError)
    return { error: 'Erro ao criar a empresa. Tente outro nome.' }
  }

  // Atualização do perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      organization_id: org.id,
      role: 'owner'
    })
    .eq('id', user.id)

  if (profileError) {
    console.error('Erro ao atualizar perfil:', profileError)
    return { error: 'Empresa criada, mas houve um erro ao vincular seu perfil.' }
  }

  await supabase.from('organization_settings').insert({ organization_id: org.id })

  revalidatePath('/', 'layout')
  return redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect('/login')
}