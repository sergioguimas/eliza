import "server-only"

import { exigirProfissionalAtivo } from "./catalogo"
import type { Db } from "./db"
import { DomainError } from "./erros"
import { ATIVOS } from "./status"
import {
  dataLocal,
  diaDaSemanaLocal,
  horaLocalParaUtc,
  limitesDoDiaUtc,
  minutosDoDiaLocal,
} from "./tempo"

/**
 * UMA fonte de verdade para "este horário cabe?". A listagem e a validação
 * chamam o mesmo predicado (`avaliarIntervalo`), então o que a lista oferece,
 * a validação aceita. Antes eram três caminhos que discordavam: a listagem
 * testava a janela com a duração da org (não a do serviço), a criação não
 * olhava ocupação e a remarcação não validava nada.
 */

export type MotivoSemHorario =
  | "organizacao_fechada" // dia fora de days_of_week
  | "profissional_sem_expediente"
  | "fora_do_expediente"
  | "intervalo" // almoço ou pausa
  | "ocupado"
  | "antecedencia_minima"
  | "fora_da_grade"
  | "agenda_cheia" // só em motivoVazio da listagem

type Faixa = [number, number] // minutos do dia, [início, fim)

export type DiaDeAgenda = {
  data: string
  passoMinutos: number // organization_settings.appointment_duration || 30
  janelas: Faixa[] // expediente org ∩ profissional
  bloqueios: Faixa[] // almoço da org + pausa do profissional
  ocupados: Faixa[] // agendamentos ATIVOS do profissional no dia
  motivoFechado: MotivoSemHorario | null
}

const PASSO_PADRAO_MINUTOS = 30

const MENSAGEM_DO_MOTIVO: Record<MotivoSemHorario, string> = {
  organizacao_fechada: "Este dia não está disponível para agendamentos.",
  profissional_sem_expediente: "O profissional não possui expediente configurado para este dia.",
  fora_do_expediente: "Horário fora do expediente.",
  intervalo: "Horário dentro de um intervalo (almoço ou pausa).",
  ocupado: "Este horário já está ocupado.",
  antecedencia_minima: "Horário já passou ou não respeita a antecedência mínima.",
  fora_da_grade: "Horário fora dos intervalos de agendamento oferecidos.",
  agenda_cheia: "Não há horários disponíveis neste dia.",
}

function paraMinutos(hora: string) {
  const [h, m] = hora.slice(0, 5).split(":").map(Number)

  return h * 60 + m
}

function paraHora(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`
}

function sobrepoe(faixas: Faixa[], inicio: number, fim: number) {
  return faixas.some(([i, f]) => inicio < f && fim > i)
}

function faixaOpcional(inicio: string | null, fim: string | null): Faixa[] {
  if (!inicio || !fim) return []

  return [[paraMinutos(inicio), paraMinutos(fim)]]
}

/** Carrega, uma vez por (org, profissional, data), tudo que o predicado precisa. */
export async function carregarDiaDeAgenda(
  db: Db,
  p: { orgId: string; profissionalId: string; data: string; ignorarAgendamentoId?: string }
): Promise<DiaDeAgenda> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data)) {
    throw new DomainError("VALIDATION_ERROR", 'Data inválida. Use "AAAA-MM-DD".')
  }

  // Valida o vínculo profissional <-> org antes de qualquer leitura da agenda:
  // roda em service role, então sem isto combinaria o expediente de uma org
  // com o profissional de outra. Também dá o NOT_FOUND de inativo/outro tenant.
  await exigirProfissionalAtivo(db, p.orgId, p.profissionalId)

  const diaSemana = diaDaSemanaLocal(p.data)
  const { inicio, fim } = limitesDoDiaUtc(p.data)

  // Recorte por sobreposição (start < fim E end > início): pega também o
  // agendamento que atravessa a meia-noite.
  let consultaOcupados = db
    .from("appointments")
    .select("start_time, end_time")
    .eq("organization_id", p.orgId)
    .eq("professional_id", p.profissionalId)
    .in("status", ATIVOS)
    .lt("start_time", fim.toISOString())
    .gt("end_time", inicio.toISOString())

  if (p.ignorarAgendamentoId) {
    consultaOcupados = consultaOcupados.neq("id", p.ignorarAgendamentoId)
  }

  const [configuracao, expediente, agendamentos] = await Promise.all([
    db
      .from("organization_settings")
      .select("days_of_week, open_hours_start, open_hours_end, lunch_start, lunch_end, appointment_duration")
      .eq("organization_id", p.orgId)
      .maybeSingle(),
    db
      .from("professional_availability")
      .select("start_time, end_time, break_start, break_end")
      .eq("professional_id", p.profissionalId)
      .eq("day_of_week", diaSemana)
      .eq("is_active", true)
      .maybeSingle(),
    consultaOcupados,
  ])

  for (const { error, rotulo } of [
    { error: configuracao.error, rotulo: "settings" },
    { error: expediente.error, rotulo: "availability" },
    { error: agendamentos.error, rotulo: "appointments" },
  ]) {
    if (error) {
      console.error(`[domain:carregarDiaDeAgenda:${rotulo}]`, error)
      throw error
    }
  }

  const settings = configuracao.data
  const disponibilidade = expediente.data
  const passoConfigurado = settings?.appointment_duration
  const passoMinutos = passoConfigurado && passoConfigurado > 0 ? passoConfigurado : PASSO_PADRAO_MINUTOS

  const base = { data: p.data, passoMinutos, janelas: [], bloqueios: [], ocupados: [] }

  // days_of_week vazio ou nulo = todos os dias abertos.
  const diasAbertos = settings?.days_of_week ?? []

  if (diasAbertos.length > 0 && !diasAbertos.includes(diaSemana)) {
    return { ...base, motivoFechado: "organizacao_fechada" }
  }

  if (!disponibilidade) {
    return { ...base, motivoFechado: "profissional_sem_expediente" }
  }

  // Org sem open_hours_* usa o expediente do profissional.
  const inicioProf = paraMinutos(disponibilidade.start_time)
  const fimProf = paraMinutos(disponibilidade.end_time)
  const inicioOrg = settings?.open_hours_start ? paraMinutos(settings.open_hours_start) : inicioProf
  const fimOrg = settings?.open_hours_end ? paraMinutos(settings.open_hours_end) : fimProf

  const inicioExpediente = Math.max(inicioOrg, inicioProf)
  const fimExpediente = Math.min(fimOrg, fimProf)

  if (inicioExpediente >= fimExpediente) {
    return { ...base, motivoFechado: "fora_do_expediente" }
  }

  // Minutos contados a partir da meia-noite local do dia pedido, com corte nas
  // bordas: o agendamento que entra de ontem ou sai para amanhã ocupa só a
  // parte que cai neste dia.
  const ocupados: Faixa[] = (agendamentos.data ?? []).map((a) => [
    Math.max(0, Math.floor((new Date(a.start_time).getTime() - inicio.getTime()) / 60000)),
    Math.min(1440, Math.ceil((new Date(a.end_time).getTime() - inicio.getTime()) / 60000)),
  ])

  return {
    ...base,
    janelas: [[inicioExpediente, fimExpediente]],
    bloqueios: [
      ...faixaOpcional(settings?.lunch_start ?? null, settings?.lunch_end ?? null),
      ...faixaOpcional(disponibilidade.break_start, disponibilidade.break_end),
    ],
    ocupados,
    motivoFechado: null,
  }
}

/** null = livre. Senão, o motivo. É a ÚNICA função que decide se um intervalo cabe. */
export function avaliarIntervalo(dia: DiaDeAgenda, inicioMin: number, fimMin: number): MotivoSemHorario | null {
  if (dia.motivoFechado) return dia.motivoFechado

  // O intervalo inteiro precisa caber dentro de uma janela de expediente.
  if (!dia.janelas.some(([i, f]) => inicioMin >= i && fimMin <= f)) return "fora_do_expediente"

  if (sobrepoe(dia.bloqueios, inicioMin, fimMin)) return "intervalo"
  if (sobrepoe(dia.ocupados, inicioMin, fimMin)) return "ocupado"

  return null
}

type Listagem = { horarios: string[]; motivoVazio: MotivoSemHorario | null; passoMinutos: number }

// Núcleo compartilhado por listarHorariosLivres e pelas sugestões do
// validarHorario (que já têm o dia carregado).
function horariosDoDia(dia: DiaDeAgenda, duracaoMinutos: number, naoAntesDe?: Date): Listagem {
  const horarios: string[] = []
  let candidatos = 0
  let cortadosPeloRelogio = 0

  for (const [inicioJanela, fimJanela] of dia.janelas) {
    for (let t = inicioJanela; t + duracaoMinutos <= fimJanela; t += dia.passoMinutos) {
      candidatos++

      if (avaliarIntervalo(dia, t, t + duracaoMinutos) !== null) continue

      if (naoAntesDe && horaLocalParaUtc(`${dia.data}T${paraHora(t)}`) < naoAntesDe) {
        cortadosPeloRelogio++
        continue
      }

      horarios.push(paraHora(t))
    }
  }

  if (horarios.length > 0) return { horarios, motivoVazio: null, passoMinutos: dia.passoMinutos }

  // Sem nenhum ponto da grade em que o serviço caiba: o expediente é curto
  // demais. Se só o relógio cortou, é o passado de hoje. O resto é almoço,
  // pausa ou agenda lotada.
  const motivoVazio: MotivoSemHorario =
    dia.motivoFechado ??
    (candidatos === 0 ? "fora_do_expediente" : cortadosPeloRelogio > 0 ? "antecedencia_minima" : "agenda_cheia")

  return { horarios, motivoVazio, passoMinutos: dia.passoMinutos }
}

function exigirDuracao(duracaoMinutos: number) {
  if (!Number.isInteger(duracaoMinutos) || duracaoMinutos <= 0) {
    throw new DomainError("VALIDATION_ERROR", "Duração inválida.")
  }
}

/**
 * Horários ("HH:mm") em que um atendimento de `duracaoMinutos` cabe, na grade
 * da org. A janela testada tem a duração do SERVIÇO: um serviço de 60 min não é
 * oferecido às 11:30 se o almoço começa às 12:00.
 *
 * `duracaoMinutos` omitido = passo da organização (comportamento antigo do
 * `getAvailableSlots` sem serviço). `passoMinutos` volta junto porque a API o
 * expõe em `meta.grid_step_minutes`.
 */
export async function listarHorariosLivres(
  db: Db,
  p: {
    orgId: string
    profissionalId: string
    data: string
    duracaoMinutos?: number
    naoAntesDe?: Date // omitido = sem corte
    ignorarAgendamentoId?: string
  }
): Promise<Listagem> {
  const dia = await carregarDiaDeAgenda(db, p)
  const duracao = p.duracaoMinutos ?? dia.passoMinutos

  exigirDuracao(duracao)

  return horariosDoDia(dia, duracao, p.naoAntesDe)
}

/**
 * Ok, ou DomainError SLOT_UNAVAILABLE com `detalhes: { motivo, sugestoes }`.
 * Com `exigirGrade`, o início também precisa cair num ponto da grade (canais de
 * terceiros: público e autoatendimento). O painel e a API aceitam horário
 * livre fora da grade (E1).
 */
export async function validarHorario(
  db: Db,
  p: {
    orgId: string
    profissionalId: string
    inicio: Date
    duracaoMinutos: number
    naoAntesDe?: Date
    exigirGrade: boolean
    ignorarAgendamentoId?: string
  }
): Promise<void> {
  exigirDuracao(p.duracaoMinutos)

  const dia = await carregarDiaDeAgenda(db, {
    orgId: p.orgId,
    profissionalId: p.profissionalId,
    data: dataLocal(p.inicio),
    ignorarAgendamentoId: p.ignorarAgendamentoId,
  })

  const inicioMin = minutosDoDiaLocal(p.inicio)
  const fimMin = inicioMin + p.duracaoMinutos

  const motivo: MotivoSemHorario | null =
    p.naoAntesDe && p.inicio < p.naoAntesDe
      ? "antecedencia_minima"
      : (avaliarIntervalo(dia, inicioMin, fimMin) ??
        (p.exigirGrade && !naGrade(dia, inicioMin) ? "fora_da_grade" : null))

  if (!motivo) return

  // Até 3 alternativas no mesmo dia e profissional, as mais próximas do pedido.
  const sugestoes = horariosDoDia(dia, p.duracaoMinutos, p.naoAntesDe)
    .horarios.map((h) => ({ h, distancia: Math.abs(paraMinutos(h) - inicioMin) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 3)
    .map((s) => s.h)
    .sort()

  throw new DomainError("SLOT_UNAVAILABLE", MENSAGEM_DO_MOTIVO[motivo], { motivo, sugestoes })
}

/** O início cai num ponto da grade (a partir do começo de cada janela)? */
function naGrade(dia: DiaDeAgenda, inicioMin: number) {
  return dia.janelas.some(([i, f]) => inicioMin >= i && inicioMin < f && (inicioMin - i) % dia.passoMinutos === 0)
}
