'use server'

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { API_SCOPES, generateApiKey, type ApiScope } from "@/lib/api/keys"
import { MENSAGEM_PLANO_SEM_API } from "@/lib/api/planos"
import { organizacaoTemApi } from "@/lib/api/plano-da-org"

const MAX_ACTIVE_KEYS = 10

async function requireOrgAdmin() {
  const session = await createClient<Database>()

  const {
    data: { user },
  } = await session.auth.getUser()

  if (!user) return { error: "Sessão expirada. Entre novamente." } as const

  // Papel e organização saem do perfil da sessão, nunca do que o cliente manda:
  // a escrita abaixo usa service role, que ignora RLS.
  const { data: profile } = await session
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || !["owner", "admin"].includes(profile.role ?? "")) {
    return { error: "Apenas administradores podem gerenciar chaves de API." } as const
  }

  if (user.user_metadata?.is_demo === true) {
    return { error: "Chaves de API não estão disponíveis na demonstração." } as const
  }

  return { userId: user.id, organizationId: profile.organization_id } as const
}

/** Devolve a chave em claro UMA vez; depois só o hash existe. */
export async function createApiKey(input: { name: string; scopes: ApiScope[]; expiresInDays?: number | null }) {
  const auth = await requireOrgAdmin()
  if ("error" in auth) return { error: auth.error }

  // A regra vale aqui, não só na tela: a UI esconde o botão, mas a action é chamável direto.
  if (!(await organizacaoTemApi(auth.organizationId))) return { error: `${MENSAGEM_PLANO_SEM_API}.` }

  const name = input.name?.trim()

  if (!name || name.length > 80) return { error: "Informe um nome de até 80 caracteres." }

  const scopes = Array.from(new Set(input.scopes)).filter((s): s is ApiScope => API_SCOPES.includes(s))

  if (!scopes.length) return { error: "Selecione ao menos um escopo." }

  const days = input.expiresInDays
  if (days != null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    return { error: "Validade inválida." }
  }

  const admin = createAdminClient<Database>()

  const { count } = await admin
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", auth.organizationId)
    .is("revoked_at", null)

  if ((count ?? 0) >= MAX_ACTIVE_KEYS) {
    return { error: `Limite de ${MAX_ACTIVE_KEYS} chaves ativas. Revogue uma antes de criar outra.` }
  }

  const key = generateApiKey()

  const { error } = await admin.from("api_keys").insert({
    organization_id: auth.organizationId,
    name,
    key_prefix: key.prefix,
    key_hash: key.hash,
    scopes,
    created_by: auth.userId,
    expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
  })

  if (error) {
    console.error("[createApiKey]", error.message)
    return { error: "Não foi possível criar a chave." }
  }

  revalidatePath("/configuracoes")

  return { success: true as const, apiKey: key.plain }
}

export async function revokeApiKey(id: string) {
  const auth = await requireOrgAdmin()
  if ("error" in auth) return { error: auth.error }

  const admin = createAdminClient<Database>()

  const { data, error } = await admin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .is("revoked_at", null)
    .select("id")

  if (error) {
    console.error("[revokeApiKey]", error.message)
    return { error: "Não foi possível revogar a chave." }
  }

  if (!data?.length) return { error: "Chave não encontrada." }

  revalidatePath("/configuracoes")

  return { success: true as const }
}
