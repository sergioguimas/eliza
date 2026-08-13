'use server'

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"

type DemoAction =
  Database["public"]["Tables"]["demo_interactions"]["Insert"]["action"]

/**
 * Registra um evento do tour.
 *
 * A organização vem da sessão, nunca do cliente: o visitante controla o próprio
 * navegador, e aceitar um `organization_id` de fora deixaria qualquer um sujar
 * a telemetria de outro tenant.
 *
 * A gravação também confirma `is_demo` no banco antes de escrever. O componente
 * do tour se habilita por `user_metadata`, que o próprio usuário consegue
 * alterar pela API de auth — bom o bastante para decidir se mostra um balão na
 * tela, insuficiente para decidir o que entra no funil.
 */
export async function logDemoInteraction({
  action,
  stepNumber,
  metadata,
}: {
  action: DemoAction
  stepNumber?: number
  metadata?: Record<string, unknown>
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false }
  }

  const supabaseAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) {
    return { ok: false }
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, niche, is_demo")
    .eq("id", profile.organization_id)
    .maybeSingle()

  if (!organization?.is_demo) {
    return { ok: false }
  }

  const { error } = await supabaseAdmin.from("demo_interactions").insert({
    organization_id: organization.id,
    niche: organization.niche,
    action,
    step_number: stepNumber ?? null,
    metadata: (metadata ?? {}) as never,
  })

  if (error) {
    console.error("❌ [DemoInteraction] Falha ao registrar evento:", error.message)
    return { ok: false }
  }

  return { ok: true }
}
