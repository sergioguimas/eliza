/**
 * Contexto do turno: uma chamada que o atendente faz antes de cada resposta.
 * Documentação: docs/contratos/autoatendimento/02-contexto-e-identificacao.md
 */
import { z } from "zod"
import { FUSO_HORARIO, HoraLocal, Momento, Uuid, apiSuccess } from "./comum"
import { AgendamentoResumo } from "./agendamentos"

/** Vocabulário do nicho (Keckleon), para o atendente falar como o estabelecimento. */
export const Termos = z.object({
  genero: z.enum(["m", "f"]),
  cliente: z.string(),
  clientePlural: z.string(),
  profissional: z.string(),
  profissionalPlural: z.string(),
  servico: z.string(),
  servicoPlural: z.string(),
  agendamento: z.string(),
  agendamentoPlural: z.string(),
})

export const Identificacao = z.discriminatedUnion("situacao", [
  z.object({
    situacao: z.literal("identificado"),
    cliente: z.object({ id: Uuid, primeiroNome: z.string() }),
  }),
  /** Nenhum cadastro com este telefone: pode consultar catálogo e se cadastrar. */
  z.object({ situacao: z.literal("desconhecido") }),
  /** Mais de um cadastro bate com o telefone: só leitura de catálogo; escalar. */
  z.object({ situacao: z.literal("ambiguo") }),
])

/** Personalização do atendente por org, já combinada com os padrões do Eliza (07 §5). */
export const Atendente = z.object({
  /** Nome com que o atendente se apresenta; null = não se apresenta por nome. */
  persona: z.string().nullable(),
  /** Tom de voz em texto livre. */
  tom: z.string().nullable(),
  /** Horas de pausa quando a equipe responde pelo celular; null = padrão do atendente. */
  pausaHumanaHoras: z.number().int().positive().nullable(),
  /** Textos fixos. `{primeiroNome}` é substituído pelo atendente. null = padrão do atendente. */
  respostas: z.object({
    confirmado: z.string().nullable(),
    cancelado: z.string().nullable(),
    falhaTecnica: z.string().nullable(),
    midiaNaoSuportada: z.string().nullable(),
    audioLongo: z.string().nullable(),
    equipeSemContato: z.string().nullable(),
  }),
  /** Palavras que, sozinhas, confirmam ou cancelam o único agendamento aguardando confirmação. */
  palavras: z.object({
    confirmar: z.array(z.string()).nullable(),
    cancelar: z.array(z.string()).nullable(),
  }),
})

export const Contexto = z.object({
  agora: Momento,
  fusoHorario: z.literal(FUSO_HORARIO),
  organizacao: z.object({
    nome: z.string(),
    nicho: z.string(),
    termos: Termos,
  }),
  expediente: z.object({
    /** 0 = domingo … 6 = sábado */
    diasDaSemana: z.array(z.number().int().min(0).max(6)),
    abertura: HoraLocal.nullable(),
    fechamento: HoraLocal.nullable(),
    almoco: z.object({ inicio: HoraLocal, fim: HoraLocal }).nullable(),
  }),
  politica: z.object({
    antecedenciaMinimaMinutos: z.number().int().nonnegative(),
    janelaMaximaDias: z.number().int().positive(),
    maxAgendamentosAtivos: z.number().int().positive(),
    /** Texto livre do estabelecimento para o atendente (avisos, tom). */
    instrucoesAtendimento: z.string().nullable(),
  }),
  identificacao: Identificacao,
  /** Futuros e ativos (pending/scheduled/confirmed). Vazio se não identificado. */
  agendamentos: z.array(AgendamentoResumo),
  /**
   * ids (contidos em `agendamentos`) com lembrete já enviado e status
   * `scheduled`: um "sim" solto do cliente provavelmente responde a um deles.
   */
  aguardandoConfirmacao: z.array(Uuid),
  /** Sempre presente; campos nulos quando a org não definiu e o Eliza não tem padrão. */
  atendente: Atendente,
})

// GET /api/v1/autoatendimento/contexto
export const ContextoResposta = apiSuccess(Contexto)

export type Atendente = z.infer<typeof Atendente>
export type Termos = z.infer<typeof Termos>
export type Identificacao = z.infer<typeof Identificacao>
export type Contexto = z.infer<typeof Contexto>
