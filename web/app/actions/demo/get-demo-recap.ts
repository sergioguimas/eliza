'use server'

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"

export type DemoRecapResult =
  | { ok: true; completedSteps: string[] }
  | { ok: false }

/**
 * Lê quais passos do tour o visitante realmente completou, para o resumo do
 * passo final. Vem de `demo_interactions`, não de uma contagem de linhas em
 * `appointments`/`service_records`: a organização já nasce com dados do seed,
 * então contar entidades misturaria o que veio pronto com o que o visitante
 * fez — o log de telemetria separa os dois com precisão.
 */
export async function getDemoRecap(): Promise<DemoRecapResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return { ok: false }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false }

  const supabaseAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.organization_id) return { ok: false }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("is_demo")
    .eq("id", profile.organization_id)
    .maybeSingle()

  if (!organization?.is_demo) return { ok: false }

  const { data: interactions } = await supabaseAdmin
    .from("demo_interactions")
    .select("metadata")
    .eq("organization_id", profile.organization_id)
    .eq("action", "step_completed")

  const completedSteps = Array.from(
    new Set(
      (interactions ?? [])
        .map((row) => (row.metadata as { step?: string } | null)?.step)
        .filter((step): step is string => Boolean(step))
    )
  )

  return { ok: true, completedSteps }
}
