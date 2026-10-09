import "server-only"

import type { z } from "zod"
import { FUSO_HORARIO, type Contexto } from "@/contracts/autoatendimento"
import { nicheDictionaries, type NicheKey } from "@/lib/dictionaries/niches"
import type { Db } from "@/lib/domain/db"
import { PADRAO_RESPOSTA_CANCELAMENTO, PADRAO_RESPOSTA_CONFIRMACAO } from "@/lib/domain/mensagens"
import { momento } from "@/lib/domain/tempo"
import { internalError } from "@/lib/http/erros"
import { listarAgendamentosDoCliente } from "./agendamentos"
import type { ConfigAutoatendimento } from "./config"
import { identificarCliente } from "./identificar"

type ContextoDoTurno = z.infer<typeof Contexto>

const MAX_AGENDAMENTOS_NO_CONTEXTO = 10

/** Nicho sem dicionário (ex.: "oficina") cai no dicionário base, que é o `generico`. */
function termosDoNicho(nicho: string): ContextoDoTurno["organizacao"]["termos"] {
  const dicionario = nicheDictionaries[(nicho in nicheDictionaries ? nicho : "generico") as NicheKey]
  const e = dicionario.entities

  return {
    genero: dicionario.gender,
    cliente: e.cliente,
    clientePlural: e.cliente_plural,
    profissional: e.profissional,
    profissionalPlural: e.profissional_plural,
    servico: e.servico,
    servicoPlural: e.servico_plural,
    agendamento: e.agendamento,
    agendamentoPlural: e.agendamento_plural,
  }
}

/** "08:00:00" -> "08:00"; vazio -> null. */
const hhmm = (valor: string | null) => (valor ? valor.slice(0, 5) : null)

/**
 * Personalização do atendente (07 §5.3): a coluna da org vence; sem ela, o
 * padrão do Eliza; sem padrão do Eliza, `null` (o atendente aplica o dele).
 * Só confirmado e cancelado têm padrão aqui, os mesmos do webhook antigo.
 * `templateCancelado` é o `msg_appointment_canceled` da org, que usa `{name}`.
 */
function montarAtendente(config: ConfigAutoatendimento, templateCancelado: string | null): ContextoDoTurno["atendente"] {
  const canceladoDaOrg = templateCancelado?.trim()
    ? templateCancelado.replace(/\{\{?\s*name\s*\}?\}/g, "{primeiroNome}")
    : null

  return {
    persona: config.atendentePersona,
    tom: config.atendenteTom,
    pausaHumanaHoras: config.pausaHumanaHoras,
    respostas: {
      confirmado: config.respostaConfirmado ?? PADRAO_RESPOSTA_CONFIRMACAO,
      cancelado: config.respostaCancelado ?? canceladoDaOrg ?? PADRAO_RESPOSTA_CANCELAMENTO,
      falhaTecnica: config.respostaFalhaTecnica,
      midiaNaoSuportada: config.respostaMidiaNaoSuportada,
      audioLongo: config.respostaAudioLongo,
      equipeSemContato: config.respostaEquipeSemContato,
    },
    palavras: { confirmar: config.palavrasConfirmar, cancelar: config.palavrasCancelar },
  }
}

/**
 * Contexto do turno (02): uma chamada antes de cada resposta do atendente.
 * `desconhecido` e `ambiguo` são dados, não erro. Nunca inclui documento,
 * e-mail, endereço, prontuário, `contato_humano_telefone` nem dado de outro cliente.
 */
export async function montarContexto(
  db: Db,
  p: { org: string; telefone: string; config: ConfigAutoatendimento }
): Promise<ContextoDoTurno> {
  const [organizacao, ajustes, identificacao] = await Promise.all([
    db.from("organizations").select("name, niche").eq("id", p.org).maybeSingle(),
    db
      .from("organization_settings")
      .select("days_of_week, open_hours_start, open_hours_end, lunch_start, lunch_end, msg_appointment_canceled")
      .eq("organization_id", p.org)
      .maybeSingle(),
    identificarCliente(db, p.org, p.telefone),
  ])

  if (organizacao.error || ajustes.error || !organizacao.data) {
    console.error("[autoatendimento:contexto]", organizacao.error ?? ajustes.error ?? "organização não encontrada")
    throw internalError()
  }

  const agora = new Date()
  const nicho = organizacao.data.niche || "generico"
  const almocoInicio = hhmm(ajustes.data?.lunch_start ?? null)
  const almocoFim = hhmm(ajustes.data?.lunch_end ?? null)

  const agendamentos =
    identificacao.situacao === "identificado"
      ? await listarAgendamentosDoCliente(db, {
          orgId: p.org,
          clienteId: identificacao.clienteId,
          config: p.config,
          limite: MAX_AGENDAMENTOS_NO_CONTEXTO,
        })
      : []

  return {
    agora: momento(agora),
    fusoHorario: FUSO_HORARIO,
    organizacao: { nome: organizacao.data.name, nicho, termos: termosDoNicho(nicho) },
    expediente: {
      diasDaSemana: ajustes.data?.days_of_week ?? [],
      abertura: hhmm(ajustes.data?.open_hours_start ?? null),
      fechamento: hhmm(ajustes.data?.open_hours_end ?? null),
      almoco: almocoInicio && almocoFim ? { inicio: almocoInicio, fim: almocoFim } : null,
    },
    politica: {
      antecedenciaMinimaMinutos: p.config.antecedenciaMinimaMinutos,
      janelaMaximaDias: p.config.janelaMaximaDias,
      maxAgendamentosAtivos: p.config.maxAgendamentosAtivos,
      instrucoesAtendimento: p.config.instrucoesAtendimento,
    },
    identificacao:
      identificacao.situacao === "identificado"
        ? {
            situacao: "identificado",
            cliente: { id: identificacao.clienteId, primeiroNome: identificacao.primeiroNome },
          }
        : { situacao: identificacao.situacao },
    agendamentos: agendamentos.map((a) => a.resumo),
    aguardandoConfirmacao: agendamentos
      .filter((a) => a.resumo.status === "scheduled" && a.lembreteEnviado)
      .map((a) => a.resumo.id),
    atendente: montarAtendente(p.config, ajustes.data?.msg_appointment_canceled ?? null),
  }
}
