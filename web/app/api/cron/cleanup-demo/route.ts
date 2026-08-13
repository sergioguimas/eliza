import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { deleteDemoOrganization } from "@/lib/demo/cleanup"

export const dynamic = "force-dynamic"

/**
 * Recolhe os tenants de demonstração vencidos.
 *
 * Roda de hora em hora, e não uma vez por dia, porque a diferença é só uma
 * linha na crontab: o pior caso de sobrevida de um tenant expirado cai de 24h
 * para 1h. Sem isso, cada visita à demonstração deixa uma organização e um
 * usuário de autenticação permanentes em produção — e usuário de auth conta
 * MAU no Supabase.
 *
 * Autenticação pelo mesmo `CRON_SECRET` de `send-reminders`, porque quem
 * dispara é a mesma crontab da VPS.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("🔥 [CRON:demo] Variáveis do Supabase ausentes.")
    return NextResponse.json({ ok: false, error: "config" }, { status: 500 })
  }

  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date().toISOString()

  try {
    const { data: expired, error } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, expires_at")
      .eq("is_demo", true)
      .lt("expires_at", now)

    if (error) throw error

    const removed: string[] = []
    const failed: { id: string; error: string }[] = []

    for (const organization of expired ?? []) {
      const result = await deleteDemoOrganization(supabaseAdmin, organization.id)

      if (result.ok) {
        removed.push(organization.id)
      } else {
        // Uma organização com problema não pode interromper a varredura: as
        // outras continuam vencendo enquanto esta espera investigação.
        console.error("🔥 [CRON:demo] Falha ao remover tenant:", {
          organizationId: organization.id,
          slug: organization.slug,
          error: result.error,
        })

        failed.push({ id: organization.id, error: result.error ?? "desconhecido" })
      }
    }

    // Volume atípico é sinal de que a demonstração virou alvo de automação, ou
    // de que o cron ficou parado. Vale aparecer no log mesmo sem alerta ativo.
    if (removed.length > 100) {
      console.warn(
        `⚠️ [CRON:demo] ${removed.length} tenants removidos numa só passagem.`
      )
    }

    console.log(
      `✅ [CRON:demo] ${removed.length} removidos, ${failed.length} com falha.`
    )

    return NextResponse.json({
      ok: true,
      timestamp: now,
      expired: expired?.length ?? 0,
      removed: removed.length,
      failed,
    })
  } catch (error: any) {
    console.error("🔥 [CRON:demo] Erro geral:", error)

    return NextResponse.json(
      { ok: false, error: error?.message ?? "erro" },
      { status: 500 }
    )
  }
}
