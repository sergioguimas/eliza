'use server'

import { createClient } from "@/utils/supabase/server"
import { randomBytes } from "crypto"

export async function generateInviteLink() {
  const supabase = await createClient()

  // 1. Quem está pedindo?
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.organization_id || profile.role !== 'admin') {
    return { error: "Apenas administradores podem convidar membros." }
  }

  // 2. Gerar um código curto (Ex: a4f1b2)
  const code = randomBytes(4).toString('hex')

  // 3. Salvar no banco (Validade: 2 dias)
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 48) // +48 horas

  const { error } = await supabase.from('invitations').insert({
    organization_id: profile.organization_id,
    code: code,
    expires_at: expiresAt.toISOString(),
    role: 'staff' // Por padrão, convidamos colaboradores (não admins)
  })

  if (error) {
    console.error(error)
    return { error: "Erro ao criar convite." }
  }

  return { code: code }
}