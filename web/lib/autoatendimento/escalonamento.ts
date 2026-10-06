import "server-only"

import type { EscalonarBody } from "@/contracts/autoatendimento"
import type { Db } from "@/lib/domain/db"
import { enviarTexto } from "@/lib/whatsapp/gateway"
import type { ConfigAutoatendimento } from "./config"
import { identificarCliente } from "./identificar"

const ROTULO_DO_MOTIVO: Record<EscalonarBody["motivo"], string> = {
  pedido_do_cliente: "o cliente pediu para falar com uma pessoa",
  cliente_ambiguo: "não foi possível identificar o cadastro do cliente",
  fora_da_politica: "pedido fora da política de atendimento automático",
  nao_entendi: "o atendimento automático não entendeu o pedido",
  reclamacao: "reclamação",
  outro: "outro motivo",
}

/** "5511987654321" -> "+55 (11) 98765-4321"; formato que não reconhece sai como "+<dígitos>". */
function formatarTelefone(telefone: string) {
  const m = telefone.match(/^55(\d{2})(\d{4,5})(\d{4})$/)

  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${telefone}`
}

/**
 * Pede ajuda humana (06). Avisa a equipe pelo WhatsApp da própria org, para o
 * `contato_humano_telefone` da config (que nunca é devolvido ao atendente).
 * Não exige cliente identificado: o ambíguo é justamente quem mais escala.
 * Sem contato configurado, ou com falha no envio, devolve `false`: não é erro
 * para o atendente, que avisa o cliente de outro jeito. Na F0 nada é gravado.
 */
export async function escalarParaEquipe(
  db: Db,
  p: { org: string; telefone: string; config: ConfigAutoatendimento; entrada: EscalonarBody }
): Promise<boolean> {
  const destino = p.config.contatoHumanoTelefone?.replace(/\D/g, "")

  if (!destino) return false

  const identificacao = await identificarCliente(db, p.org, p.telefone)
  const nome = identificacao.situacao === "identificado" ? identificacao.primeiroNome : "não identificado"

  const texto = [
    "🙋 Atendimento pediu ajuda humana",
    `Cliente: ${nome} (${formatarTelefone(p.telefone)})`,
    `Motivo: ${ROTULO_DO_MOTIVO[p.entrada.motivo]}`,
    p.entrada.resumo,
  ].join("\n")

  const envio = await enviarTexto({ organizationId: p.org, telefone: destino, texto })

  if (!envio.ok) console.error("[autoatendimento:escalonamentos] falha ao avisar a equipe:", envio.erro)

  return envio.ok
}
