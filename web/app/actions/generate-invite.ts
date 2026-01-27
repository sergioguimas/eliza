'use server'

import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"

export async function generateInvite(
  organizationId: string, 
  role: 'staff' | 'professional' | 'admin' = 'staff'
) {
  const supabase = await createClient()

  // 1. Verifica Usuário Logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  // 2. Busca perfil para validar permissões
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as any

  // SEGURANÇA: Verifica se o usuário realmente pertence à organização
  if (!profile || profile.organization_id !== organizationId) {
    return { error: "Você não tem permissão para gerar convites desta organização." }
  }

  const isAllowed = ['owner', 'admin'].includes(profile.role)
  if (!isAllowed) {
    return { error: "Apenas Donos e Administradores podem convidar membros." }
  }

  // 3. Gera código aleatório (8 caracteres)
  const code = Math.random().toString(36).substring(2, 10).toUpperCase()

  // 4. Define expiração (7 dias)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // 5. Salva no Banco
  const { error } = await (supabase.from('invitations') as any)
    .insert({
      organization_id: organizationId,
      code,
      role, 
      expires_at: expiresAt.toISOString()
    })

  if (error) {
    console.error("Erro ao criar convite:", error)
    return { error: "Erro ao registrar convite no banco de dados." }
  }

  // 6. Monta URL de Retorno
  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'
  const url = `${origin}/convite/${code}`

  return { url }
}