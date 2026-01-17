'use server'

import { createClient } from "@/utils/supabase/server"
import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function registerStaffFromInvite(formData: FormData) {
  const code = formData.get('invite_code') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  if (!email || !password || !fullName || !code) {
    return { error: "Todos os campos são obrigatórios." }
  }

  // 1. Configurar Admin (God Mode)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return { error: "Erro de configuração no servidor." }

  const supabaseAdmin = createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    // 2. Validar o Convite
    const { data: invite } = await (supabaseAdmin.from('invitations') as any)
      .select('*')
      .eq('code', code)
      .single()

    if (!invite) return { error: "Convite inválido." }

    const now = new Date()
    const expires = new Date(invite.expires_at)
    if (now > expires) return { error: "Convite expirado." }

    // 3. Validar se email bate com o convite
    if (invite.email && invite.email !== email) {
      return { error: "Este convite foi enviado para outro endereço de e-mail." }
    }

    // 4. CRIAR O USUÁRIO NO AUTH
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (authError) {
      console.error("Erro ao criar user:", authError)
      return { error: "Erro ao criar conta. Este email já pode estar em uso." }
    }

    if (!authUser.user) return { error: "Erro inesperado na criação do usuário." }

    // 5. O Trigger 'handle_new_user' vai rodar automaticamente e criar o Profile
    // Pequeno delay para garantir que o trigger rodou
    const { error: profileError } = await (supabaseAdmin.from('profiles') as any)
      .update({
        organization_id: invite.organization_id,
        role: invite.role, // 'staff' ou 'professional'
        full_name: fullName
      })
      .eq('id', authUser.user.id)

    if (profileError) {
      console.error("Erro ao vincular perfil:", profileError)
      return { error: "Conta criada, mas houve erro ao vincular à empresa. Contate o suporte." }
    }

    // 6. Atualiza uso do convite
    await (supabaseAdmin.from('invitations') as any)
      .update({ used_count: (invite.used_count || 0) + 1 })
      .eq('id', invite.id)

  } catch (err) {
    console.error("Erro geral:", err)
    return { error: "Erro interno ao processar cadastro." }
  }

  return { success: true }
}