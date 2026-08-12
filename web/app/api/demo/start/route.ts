import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { getNicheMetadata } from "@/lib/niche-config"
import {
  DEMO_ENTRY_PATH,
  DEMO_RATE_LIMITS,
  DEMO_TTL_MS,
  isDemoNiche,
} from "@/lib/demo/config"
import {
  consumeRateLimit,
  getClientIp,
  hashIdentifier,
} from "@/lib/demo/rate-limit"
import { deleteDemoOrganization } from "@/lib/demo/cleanup"

export const dynamic = "force-dynamic"

/**
 * Cria um tenant de demonstração e já deixa o visitante logado nele.
 *
 * É route handler, e não server action, por um motivo concreto: precisa
 * escrever o cookie de sessão do Supabase na resposta.
 *
 * O tenant NASCE POR SERVICE ROLE, e isso não é preferência de estilo.
 * `organizations.is_demo` e `expires_at` ficaram de fora dos grants de coluna
 * do papel `authenticated` de propósito — senão qualquer usuário marcaria a
 * própria organização como demo. Um client anônimo ou autenticado levaria
 * `permission denied` na coluna, e o erro não faria sentido olhando a policy,
 * porque quem barra é o privilégio de coluna, não o RLS.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("🔥 [DemoStart] Variáveis de ambiente do Supabase ausentes.")
    return NextResponse.json({ error: "Erro de configuração." }, { status: 500 })
  }

  let niche: unknown

  try {
    const body = await request.json()
    niche = body?.niche
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 })
  }

  if (!isDemoNiche(niche)) {
    return NextResponse.json(
      { error: "Segmento indisponível para demonstração." },
      { status: 400 }
    )
  }

  const supabaseAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ipKey = hashIdentifier("ip", getClientIp(request))

  for (const window of [DEMO_RATE_LIMITS.perHour, DEMO_RATE_LIMITS.perDay]) {
    const result = await consumeRateLimit(
      supabaseAdmin,
      `${ipKey}:${window.windowMs}`,
      window
    )

    if (!result.allowed) {
      return NextResponse.json(
        { error: "Muitas demonstrações a partir deste acesso. Tente mais tarde." },
        {
          status: 429,
          headers: result.retryAfterSeconds
            ? { "Retry-After": String(result.retryAfterSeconds) }
            : undefined,
        }
      )
    }
  }

  const meta = getNicheMetadata(niche)
  const handle = crypto.randomUUID()
  const email = `demo-${handle}@demo.eliza.sgdev.cloud`
  const password = `${crypto.randomUUID()}Aa1!`
  const expiresAt = new Date(Date.now() + DEMO_TTL_MS)

  let userId: string | null = null
  let organizationId: string | null = null

  try {
    // `email_confirm: true` evita qualquer disparo de e-mail: a caixa não
    // existe e ninguém precisa confirmar nada para usar a demonstração.
    const { data: created, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Visitante da demonstração", is_demo: true },
      })

    if (userError || !created.user) {
      throw userError ?? new Error("Falha ao criar usuário de demonstração.")
    }

    userId = created.user.id

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: `Demonstração — ${meta.label}`,
        slug: `demo-${handle}`,
        niche,
        is_demo: true,
        expires_at: expiresAt.toISOString(),
        subscription_status: "active",
        plan: "demo",
      })
      .select("id")
      .single()

    if (orgError || !org) {
      throw orgError ?? new Error("Falha ao criar organização de demonstração.")
    }

    organizationId = org.id

    // O perfil já existe: o trigger `handle_new_user` cria a linha junto com o
    // usuário. Aqui só o vinculamos à organização, como faz `createOrganization`.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: org.id, role: "owner" })
      .eq("id", created.user.id)

    if (profileError) {
      throw profileError
    }

    // TODO (Fase 3): semear profissionais, serviços, clientes e agenda do nicho
    // antes do login, para o visitante cair num dashboard já povoado.

    const supabase = await createServerClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      throw signInError
    }

    await supabaseAdmin.from("demo_interactions").insert({
      organization_id: org.id,
      niche,
      action: "tour_started",
      step_number: 1,
      metadata: { ip_key: ipKey },
    })

    return NextResponse.json({
      ok: true,
      redirectTo: DEMO_ENTRY_PATH,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("🔥 [DemoStart] Falha ao criar demonstração:", error)

    // Sem esta limpeza, uma falha no meio do caminho deixa órfãos: usuário sem
    // organização (que cairia em /setup) ou organização sem dono. O cleanup
    // diário só recolhe organizações, então o usuário ficaria para sempre.
    //
    // A remoção passa pelo helper porque apagar a organização direto falha:
    // um trigger já criou `organization_settings`, cuja FK não tem cascade.
    if (organizationId) {
      const cleanup = await deleteDemoOrganization(supabaseAdmin, organizationId)

      if (!cleanup.ok) {
        console.error("🔥 [DemoStart] Rollback incompleto:", cleanup.error)
      }
    } else if (userId) {
      // Falhou antes da organização existir: só o usuário precisa sumir.
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }

    return NextResponse.json(
      { error: "Não foi possível iniciar a demonstração." },
      { status: 500 }
    )
  }
}
