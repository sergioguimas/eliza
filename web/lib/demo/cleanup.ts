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
  const { data: org, error: readError } = await supabaseAdmin
    .from("organizations")
    .select("id, is_demo")
    .eq("id", organizationId)
    .maybeSingle()

  if (readError) {
    return { ok: false, error: `Falha ao ler organização: ${readError.message}` }
  }

  if (!org) {
    return { ok: true }
  }

  if (!org.is_demo) {
    console.error(
      "🚫 [DemoCleanup] Recusado: organização não é de demonstração.",
      { organizationId }
    )

    return { ok: false, error: "Organização não é de demonstração." }
  }

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
