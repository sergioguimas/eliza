'use server'

import { createClient } from '@/utils/supabase/server' // Confirme seu caminho de importação
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// Função de Login
export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  const supabase = await createClient() // Await aqui

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Credenciais inválidas.' }
  }

  redirect('/dashboard')
}

// Função de Cadastro
export async function signUp(formData: FormData) {
  const headersList = await headers() 
  const origin = headersList.get('origin')

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  
  const supabase = await createClient() // Await aqui

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Verifique seu email para confirmar o cadastro.' }
  redirect('/setup')
}

// Função de Criar Empresa
export async function createCompany(formData: FormData) {
  const supabase = await createClient() // Await aqui
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Usuário não autenticado.' }
  }

  const companyName = formData.get('companyName') as string
  
  const slug = companyName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-') + '-' + Math.floor(Math.random() * 10000)

  // Agora usando 'organizations' corretamente
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
  const supabase = await createClient() // Await aqui
  await supabase.auth.signOut()
  return redirect('/auth/login')
}