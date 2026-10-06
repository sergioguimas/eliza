import "server-only"

import { createAdminClient } from "@/utils/supabase/admin"
import { Database } from "@/utils/database.types"
import { planoPermiteApi } from "./planos"

/**
 * A org pode usar a API? Lê `organizations.plan` por service role porque o papel
 * `authenticated` não enxerga colunas de billing (ver configuracoes/page.tsx).
 * Usado pela tela de chaves (aviso) e pela server action de criar (regra no servidor).
 */
export async function organizacaoTemApi(organizationId: string): Promise<boolean> {
  const admin = createAdminClient<Database>()

  const { data } = await admin.from("organizations").select("plan").eq("id", organizationId).maybeSingle()

  return planoPermiteApi(data?.plan)
}
