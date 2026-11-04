import "server-only"

import type { Database } from "@/utils/database.types"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { carregarConfig } from "./config"
import type { Operador } from "./treino"
import { papelTreina, primeiroNome, treinoConfigurado } from "./treino-regras"

export type AcessoTreino =
  /** Sem sessão, papel errado, ou org sem add-on: a página responde 404 e o link some. */
  | { estado: "negado" }
  /** Add-on ativo, mas o servidor não tem as envs: o link aparece e a página avisa. */
  | { estado: "sem_env" }
  | { estado: "ok"; operador: Operador }

/**
 * Verificações do contrato 10 §1. A página e TODA server action passam por aqui:
 * nenhuma confia em a outra ter checado. `operador` sai sempre do servidor; nada
 * dele vem do navegador.
 */
export async function acessoTreino(): Promise<AcessoTreino> {
  const supabase = await createClient<Database>()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { estado: "negado" }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("organization_id, role, full_name")
    .eq("id", user.id)
    .single()

  if (!perfil?.organization_id || !papelTreina(perfil.role)) return { estado: "negado" }

  // Service role: `autoatendimento_config` e `is_demo` não são legíveis pela sessão.
  const config = await carregarConfig(createAdminClient(), perfil.organization_id)

  if (!config) return { estado: "negado" }

  if (!treinoConfigurado(process.env.ATENDENTE_URL, process.env.ATENDENTE_TREINO_SECRET)) {
    console.warn("[atendente:treino] env ausente")
    return { estado: "sem_env" }
  }

  return {
    estado: "ok",
    operador: {
      tenant: perfil.organization_id,
      id: user.id,
      papel: perfil.role,
      nome: primeiroNome(perfil.full_name),
    },
  }
}
