'use server'

import { createClient } from "@/utils/supabase/server"
import { randomBytes } from "crypto"
import { headers } from "next/headers"

// Agora aceitamos o 'role' como parâmetro
export async function generateInviteLink(role: 'professional' | 'staff' = 'staff') {
  const supabase = await createClient()

  // 1. Quem está pedindo?
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  // Apenas donos ou admins podem convidar (ajuste conforme sua regra de negócio)
  const isAllowed = profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'professional'

  if (!profile || !profile.organization_id || !isAllowed) {
    return { error: "Você não tem permissão para convidar membros." }
  }

  // 2. Gerar um código curto (Ex: a4f1b2)
  const code = randomBytes(4).toString('hex')

  // 3. Salvar no banco (Validade: 48 horas)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 48)

  const { error } = await supabase.from('invitations').insert({
    organization_id: profile.organization_id,
    code: code,
    expires_at: expiresAt.toISOString(),
    role: role // <--- SALVAMOS O CARGO AQUI
  })

  if (error) {
    console.error("Erro ao criar convite:", error)
    return { error: "Erro ao gerar convite no banco de dados." }
  }

  // 4. Montar URL
  const origin = (await headers()).get('origin')
  const inviteUrl = `${origin}/convite/${code}`

  return { code, url: inviteUrl }
}