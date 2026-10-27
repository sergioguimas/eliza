import "server-only"

import { createHash } from "node:crypto"
import type { Db } from "@/lib/domain/db"
import { createAdminClient } from "@/utils/supabase/admin"
import { carregarConfig } from "./config"

/**
 * Envios automáticos do Eliza pelo número da org (09-avisos-do-sistema).
 *
 * O atendente e a equipe usam o mesmo número: todo `fromMe` volta pelo webhook
 * e, sem esta marca, o atendente pausa achando que a equipe assumiu. O registro
 * é gravado ANTES do envio (o eco pode chegar antes da resposta da Evolution) e
 * casado pelo texto; o encaminhamento manda o eco como `aviso`.
 */

export type TipoAviso = "lembrete" | "resumo_profissional" | "notificacao" | "resposta_automatica" | "escalonamento"

/** Janela em que o eco casa com o registro. */
const JANELA_MS = 10 * 60 * 1000
/** Registros mais velhos que isto somem no próximo registro da mesma org. */
const RETENCAO_MS = 24 * 60 * 60 * 1000

/** hex(sha256(texto normalizado)); normalização: \r\n → \n, depois trim. */
export function hashDoTexto(texto: string) {
  return createHash("sha256").update(texto.replace(/\r\n/g, "\n").trim()).digest("hex")
}

/**
 * Chamada ANTES do envio. Grava só com ATENDENTE_URL configurada e o add-on
 * ativo na org; senão não faz nada. Nunca lança: falha vira log e o envio
 * segue (o pior caso é o comportamento antigo, a pausa).
 */
export async function registrarEnvioSistema(p: { organizationId: string; tipo: TipoAviso; texto: string }) {
  if (!process.env.ATENDENTE_URL?.trim() || !p.texto.trim()) return

  try {
    const db = createAdminClient()

    if (!(await carregarConfig(db, p.organizationId))) return

    const { error } = await db
      .from("autoatendimento_envios_sistema")
      .insert({ organization_id: p.organizationId, tipo: p.tipo, texto_hash: hashDoTexto(p.texto) })

    if (error) {
      console.error("[autoatendimento:envios-sistema] registro falhou:", error.message)
      return
    }

    const { error: erroLimpeza } = await db
      .from("autoatendimento_envios_sistema")
      .delete()
      .eq("organization_id", p.organizationId)
      .lt("created_at", new Date(Date.now() - RETENCAO_MS).toISOString())

    if (erroLimpeza) console.error("[autoatendimento:envios-sistema] limpeza falhou:", erroLimpeza.message)
  } catch (error) {
    console.error("[autoatendimento:envios-sistema] registro falhou:", (error as Error)?.message)
  }
}

/** O texto bate com um envio automático da org nos últimos 10 minutos? Lança em erro de banco. */
export async function tipoDoEnvioSistema(db: Db, organizationId: string, texto: string): Promise<TipoAviso | null> {
  const { data, error } = await db
    .from("autoatendimento_envios_sistema")
    .select("tipo")
    .eq("organization_id", organizationId)
    .eq("texto_hash", hashDoTexto(texto))
    .gte("created_at", new Date(Date.now() - JANELA_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return (data?.tipo as TipoAviso | undefined) ?? null
}
