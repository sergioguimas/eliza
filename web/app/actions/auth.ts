'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// Helper para pegar o destino ou usar o padrão
function getRedirectUrl(formData: FormData, defaultUrl: string) {
  const next = formData.get('redirectTo') as string
  if (next && next.startsWith('/')) { // Segurança básica para evitar open redirect
    return next
  }
  return defaultUrl
}

// Função de Login
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = getRedirectUrl(formData, '/dashboard') // <--- Pega o destino (ex: /convite/...)
  
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect(redirectTo) // Redireciona para o convite se houver
}

// Função de Cadastro
export async function signUp(formData: FormData) {
  const headersList = await headers() 
  const origin = headersList.get('origin')
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const redirectTo = getRedirectUrl(formData, '/setup') // <--- Pega o destino

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      // Passamos o next também para o email de confirmação (se precisar confirmar)
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Se o Supabase estiver com "Auto Confirm" (comum em dev), já loga e redireciona
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    redirect(redirectTo)
  }

  return { success: 'Verifique seu email para confirmar o cadastro.' }
}

// Função de Criar Empresa
export async function createCompany(formData: FormData) {
  const supabase = await createClient() as any 
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const companyName = formData.get('companyName') as string
  
  // Geração de slug simples
  const slug = companyName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 10000)

  // Inserção na tabela organizations
  const { data: org, error: orgError } = await supabase
    .from('organizations') 
    .insert({
      name: companyName,
      slug: slug,
      industry: 'medical', 
      settings: {
        theme: 'blue',
        labels: {
          staff: 'Profissional',
          client: 'Cliente'
        }
      }
    })
    .select()
    .single()

  if (orgError) {
    console.error('Erro ao criar organização:', orgError)
    return { error: 'Erro ao criar a empresa. Tente outro nome.' }
  }

  // Atualização do perfil do dono
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      organization_id: org.id,
      role: 'owner',
      metadata: {
        onboarding_completed: true
      }
    })
    .eq('id', user.id)

  if (profileError) {
    console.error('Erro ao atualizar perfil:', profileError)
    return { error: 'Empresa criada, mas houve um erro ao vincular seu perfil.' }
  }

  revalidatePath('/', 'layout')
  return redirect('/dashboard')
}

// Função de Logout
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect('/login') // Corrigi para /login (sem /auth)
}