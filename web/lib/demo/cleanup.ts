import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/utils/database.types"

type AdminClient = SupabaseClient<Database>

/**
 * Ordem de remoção dos dados de uma organização.
 *
 * Sete tabelas referenciam `organizations` sem `ON DELETE CASCADE`
 * (`appointments`, `customers`, `estimates`, `organization_settings`,
 * `profiles`, `service_records`, `services`), então apagar a organização
 * direto falha com violação de chave estrangeira. As demais até cascateiam,
 * mas isso não ajuda: `appointments` aponta para `professionals`, que
 * cascateia — o cascade tentaria remover o profissional antes do agendamento
 * e esbarraria na FK.
 *
 * A ordem abaixo é filha antes de mãe, respeitando também as FKs entre as
 * próprias filhas: prontuário aponta para agendamento, agendamento aponta
 * para cliente, serviço e profissional.
 */
const CHILD_TABLES = [
  "service_records",
  "appointments",
  "estimates",
  "customers",
  "services",
  "organization_settings",
] as const

/**
 * Ordem de limpeza do reset, que esvazia a organização sem apagá-la.
 *
 * Difere da lista acima em dois pontos. `professionals` entra porque só some
 * por cascata da organização, que aqui continua de pé. E
 * `organization_settings` fica de fora: quem cria essa linha é o trigger do
 * insert da organização, então apagá-la não teria quem a recriasse e a
 * demonstração perderia as mensagens configuradas.
 *
 * `professional_availability`, `appointment_logs` e `notification_dispatches`
 * não aparecem porque cascateiam dos pais que estão aqui.
 */
const RESET_TABLES = [
  "demo_timeline_events",
  "service_records",
  "appointments",
  "estimates",
  "expenses",
  "customers",
  "services",
  "professionals",
] as const

async function assertDemoOrganization(
  supabaseAdmin: AdminClient,
  organizationId: string
): Promise<{ ok: true; exists: boolean } | { ok: false; error: string }> {
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, is_demo")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: `Falha ao ler organização: ${error.message}` }
  }

  if (!org) {
    return { ok: true, exists: false }
  }

  if (!org.is_demo) {
    console.error(
      "🚫 [DemoCleanup] Recusado: organização não é de demonstração.",
      { organizationId }
    )

    return { ok: false, error: "Organização não é de demonstração." }
  }

  return { ok: true, exists: true }
}

/**
 * Esvazia uma organização de demonstração, preservando a organização, o perfil
 * e a sessão de quem está usando. Serve para o visitante recomeçar o tour sem
 * passar de novo pela criação de tenant — e sem perder o login no meio.
 *
 * Não semeia: quem chama decide o nicho e chama o seed em seguida.
 */
export async function resetDemoOrganization(
  supabaseAdmin: AdminClient,
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  const check = await assertDemoOrganization(supabaseAdmin, organizationId)

  if (!check.ok) return { ok: false, error: check.error }
  if (!check.exists) return { ok: false, error: "Organização não encontrada." }

  for (const table of RESET_TABLES) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("organization_id", organizationId)

    if (error) {
      return { ok: false, error: `Falha ao limpar ${table}: ${error.message}` }
    }
  }

  return { ok: true }
}

/**
 * Remove por completo uma organização de demonstração: dados, perfis, usuários
 * de autenticação e a própria organização.
 *
 * `demo_interactions` e `demo_leads` são `ON DELETE SET NULL` e sobrevivem de
 * propósito — o funil precisa de histórico depois que o tenant expira.
 * `demo_timeline_events` é cascade e some junto.
 *
 * Usada tanto no rollback da criação quanto pelo cleanup periódico.
 */
export async function deleteDemoOrganization(
  supabaseAdmin: AdminClient,
  organizationId: string
): Promise<{ ok: boolean; error?: string }> {
  // Trava de segurança: esta função apaga tudo o que pertence à organização.
  // Apontá-la para um tenant real seria destrutivo e irreversível, então ela
  // confirma `is_demo` no banco em vez de confiar em quem chamou.
  const check = await assertDemoOrganization(supabaseAdmin, organizationId)

  if (!check.ok) return { ok: false, error: check.error }

  // Organização já ausente é sucesso: o objetivo é o estado final.
  if (!check.exists) return { ok: true }

  // Apagar o usuário de auth cascateia o perfil (profiles.id → auth.users.id),
  // que é uma das FKs sem cascade para organizations.
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)

  if (profilesError) {
    return { ok: false, error: `Falha ao listar perfis: ${profilesError.message}` }
  }

  for (const profile of profiles ?? []) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(profile.id)

    // Usuário já ausente não é falha: o objetivo é o estado final, não o passo.
    if (error && !/not found/i.test(error.message)) {
      return { ok: false, error: `Falha ao remover usuário: ${error.message}` }
    }
  }

  for (const table of CHILD_TABLES) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("organization_id", organizationId)

    if (error) {
      return { ok: false, error: `Falha ao limpar ${table}: ${error.message}` }
    }
  }

  const { error: orgError } = await supabaseAdmin
    .from("organizations")
    .delete()
    .eq("id", organizationId)

  if (orgError) {
    return { ok: false, error: `Falha ao remover organização: ${orgError.message}` }
  }

  return { ok: true }
}
