'use server'

import { createClient } from '@/utils/supabase/server'
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

  return {
    success: true,
    redirectTo,
  }
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
    return {
      success: true,
      redirectTo,
    }
  }

  return {
    success: 'Verifique seu email para confirmar o cadastro.',
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect('/login')
}