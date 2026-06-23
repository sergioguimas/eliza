'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { Database } from "@/utils/database.types"
import { isValidEmail, normalizeEmail } from "@/lib/validation"
import { getAppUrl } from "@/lib/app-url"

function generateTemporaryPassword() {
  return `${crypto.randomUUID()}Aa1!`
}

export async function createTenant(formData: FormData) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const godEmail = process.env.NEXT_PUBLIC_GOD_EMAIL

  if (!serviceRoleKey || !supabaseUrl) {
    return { error: 'Erro de configuração interna.' }
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email !== godEmail) {
    return { error: 'Não autorizado.' }
  }

  const email = normalizeEmail(String(formData.get('email') || ''))
  const tenantName = String(formData.get('orgName') || '').trim()

  if (!tenantName) {
    return { error: 'Nome da organização é obrigatório.' }
  }

  if (!email) {
    return { error: 'E-mail do responsável é obrigatório.' }
  }

  if (!isValidEmail(email)) {
    return { error: 'Informe um e-mail válido.' }
  }

  try {
    const temporaryPassword = generateTemporaryPassword()

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: `Admin ${tenantName}`,
        },
      })

    if (authError) throw authError
    if (!authUser.user) throw new Error("Falha ao criar usuário")

    const appUrl = await getAppUrl()
    const nextPath = "/update-password?first_access=true"

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      }
    )

    if (resetError) {
      console.error('[createTenant:resetPasswordForEmail]', resetError)

      return {
        error:
          'Usuário criado, mas não foi possível enviar o e-mail de definição de senha.',
      }
    }

    return {
      success: true,
      message: `Usuário criado. Um link para criação de senha foi enviado para ${email}.`,
    }
  } catch (error) {
    console.error('Erro:', error)
    return {
      error: error instanceof Error ? error.message : 'Erro ao criar usuário.',
    }
  }
}
