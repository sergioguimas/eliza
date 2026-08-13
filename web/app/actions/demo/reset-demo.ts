'use server'

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { resetDemoOrganization } from "@/lib/demo/cleanup"
import { seedDemoOrganization } from "@/lib/demo/seed"
import { isDemoNiche } from "@/lib/demo/config"

/**
 * Recomeça a demonstração do zero, sem derrubar a sessão.
 *
 * A organização vem sempre da sessão, nunca de parâmetro: esta função apaga
 * dados, e aceitar um id de fora deixaria o visitante apontá-la para outro
 * tenant. A verificação de `is_demo` acontece de novo dentro do
 * `resetDemoOrganization`, no banco.
 *
 * `expires_at` fica como está, de propósito. Renovar o prazo a cada reset
 * permitiria manter um tenant vivo indefinidamente clicando em "recomeçar", e o
 * ponto da demonstração é justamente ser efêmera.
 *
 * O progresso do tour vive no `localStorage` do visitante; limpar isso é
 * responsabilidade de quem chama, no cliente.
 */
export async function resetDemo() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, error: "Erro de configuração." }
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Sessão expirada." }
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
    return { ok: false, error: "Organização não encontrada." }
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, niche, is_demo")
    .eq("id", profile.organization_id)
    .maybeSingle()

  if (!organization?.is_demo) {
    return { ok: false, error: "Esta organização não é de demonstração." }
  }

  if (!isDemoNiche(organization.niche)) {
    return { ok: false, error: "Segmento indisponível para demonstração." }
  }

  const cleared = await resetDemoOrganization(supabaseAdmin, organization.id)

  if (!cleared.ok) {
    console.error("🔥 [DemoReset] Falha ao limpar:", cleared.error)
    return { ok: false, error: "Não foi possível recomeçar a demonstração." }
  }

  const seeded = await seedDemoOrganization(supabaseAdmin, {
    organizationId: organization.id,
    niche: organization.niche,
    ownerProfileId: user.id,
  })

  if (!seeded.ok) {
    console.error("🔥 [DemoReset] Falha ao semear:", seeded.error)
    return { ok: false, error: "Não foi possível recomeçar a demonstração." }
  }

  revalidatePath("/", "layout")

  return { ok: true }
}
