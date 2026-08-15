'use server'

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { logDemoInteraction } from "@/app/actions/demo/log-demo-interaction"

const MAX_FIELD_LENGTH = 200

export async function submitDemoLead(input: {
  name: string
  contact: string
}): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim().slice(0, MAX_FIELD_LENGTH)
  const contact = input.contact.trim().slice(0, MAX_FIELD_LENGTH)

  if (!name || !contact) {
    return { ok: false, error: "Preencha nome e contato." }
  }

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

  // `demo_leads` sobrevive à expiração do tenant (organization_id vira null),
  // então é o único lugar que guarda esse contato depois que o cleanup passa —
  // nome e contato NÃO entram em `demo_interactions.metadata`, para não
  // duplicar o mesmo dado pessoal em duas tabelas com regras de retenção
  // diferentes.
  const { error } = await supabaseAdmin.from("demo_leads").insert({
    organization_id: organization.id,
    niche: organization.niche,
    name,
    contact,
    source: "demo_tour",
  })

  if (error) {
    console.error("🔥 [DemoLead] Falha ao gravar lead:", error.message)
    return { ok: false, error: "Não foi possível enviar. Tente de novo." }
  }

  // stepNumber 11: índice do passo "cta" (o último) em `buildDemoTour` — ver
  // lib/demo/tour.ts. Precisa ficar em sincronia manual porque este action
  // não importa a lista de passos, só grava o número.
  await logDemoInteraction({ action: "lead_captured", stepNumber: 11 })

  return { ok: true }
}
