import "server-only"

import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { exigirProfissionalAtivo, exigirServicoAtivo } from "./catalogo"
import { resolverCliente, type NovoCliente } from "./clientes"
import type { Db } from "./db"
import { DomainError } from "./erros"
import { validarHorario } from "./horarios"
import {
  mensagemAlteracao,
  mensagemCancelamento,
  mensagemConfirmacao,
  mensagemCriacao,
  mensagemPedidoAprovado,
  mensagemPedidoRecusado,
  type DadosMensagem,
} from "./mensagens"
import {
  METODOS_PAGAMENTO,
  STATUS_DE_PAGAMENTO,
  TRANSICOES,
  ehStatus,
  podeEditar,
  podeReceberPagamento,
  podeTransicionar,
  type Status,
  type StatusPagamento,
} from "./status"
import { dataLocal, limitesDoDiaUtc, momento, utcParaHoraLocal, type Momento } from "./tempo"

export type Canal = "painel" | "publico" | "api" | "autoatendimento" | "whatsapp_webhook"

/** O que o ator precisa saber para decidir se a mensagem sai. */
export type ContextoNotificacao = { clienteCriado: boolean }

export type Ator = {
  canal: Canal
  organizationId: string
  /** vai para appointment_logs.source: "painel", "publico", "api:elz_live_ab12cd", "autoatendimento", "whatsapp_webhook" */
  origem: string
  /**
   * null = não notifica. Função = notifica se devolver true (teto por org do público, D6 da API).
   * Recebe `clienteCriado` (só a criação pode criar cliente) para o ator recusar quem acabou de nascer (D6).
   */
  podeNotificar: null | ((contexto: ContextoNotificacao) => Promise<boolean>)
  /** Nome do contato no canal (push_name do WhatsApp); só vai para o log. */
  pushName?: string | null
}

// Mesmo shape de `serializeAppointment` (lib/api/domain/appointments.ts, apagado na etapa 3), com
// início e fim como Momento (UTC + relógio local).
export type AgendamentoCompleto = {
  id: string
  status: Status
  inicio: Momento
  fim: Momento
  customer: { id: string; name: string | null; phone: string | null }
  service: { id: string; title: string; duration_minutes: number } | null
  professional: { id: string; name: string } | null
  price: number | null
  payment_status: string | null
  payment_method: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

type Linha = {
  id: string
  organization_id: string
  status: string | null
  start_time: string
  end_time: string
  notes: string | null
  price: number | null
  payment_status: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
  updated_at: string | null
  customer_id: string
  professional_id: string | null
  service_id: string | null
  customers: { id: string; name: string; phone: string } | null
  services: { id: string; title: string; duration_minutes: number | null } | null
  professionals: { id: string; name: string; phone: string | null } | null
}

const SELECT = `
  id, organization_id, status, start_time, end_time, notes, price, payment_status,
  payment_method, paid_at, created_at, updated_at, customer_id, professional_id, service_id,
  customers ( id, name, phone ),
  services ( id, title, duration_minutes ),
  professionals ( id, name, phone )
`

const MSG_ALTERADO_POR_OUTRA_PESSOA = "O agendamento foi alterado por outra pessoa; atualize a tela."

const rotulo = (status: string) => STATUS_CONFIG[status]?.label ?? status

// Só os canais de terceiros exigem que o início caia na grade oferecida (E1).
const exigeGrade = (canal: Canal) => canal === "publico" || canal === "autoatendimento"

/**
 * Horário mais cedo aceito para criar/remarcar. O painel aceita qualquer
 * horário de HOJE (decisão de 2026-10-06): a recepção lança o encaixe que já
 * começou ou registra à noite os atendimentos do dia. Os demais canais só
 * aceitam o futuro, mais a antecedência da política do canal.
 */
function corteDeHorario(canal: Canal, agora: Date, antecedenciaMinutos = 0): Date {
  if (canal === "painel") return limitesDoDiaUtc(dataLocal(agora)).inicio

  return new Date(agora.getTime() + antecedenciaMinutos * 60000)
}

/** Todo acesso por id passa por aqui: id E tenant, senão NOT_FOUND. */
async function carregar(db: Db, orgId: string, id: string): Promise<Linha> {
  const { data, error } = await db
    .from("appointments")
    .select(SELECT)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()

  // 22P02: id que não é UUID. Para quem chama é o mesmo que não existir.
  if (error && error.code !== "22P02") {
    console.error("[domain:carregarAgendamento]", error)
    throw error
  }

  if (!data) throw new DomainError("NOT_FOUND", "Agendamento não encontrado.")

  return data as unknown as Linha
}

function completo(l: Linha): AgendamentoCompleto {
  return {
    id: l.id,
    status: l.status as Status,
    inicio: momento(l.start_time),
    fim: momento(l.end_time),
    customer: l.customers
      ? { id: l.customers.id, name: l.customers.name, phone: l.customers.phone }
      : { id: l.customer_id, name: null, phone: null },
    service: l.services
      ? {
          id: l.services.id,
          title: l.services.title,
          duration_minutes: l.services.duration_minutes || 30,
        }
      : null,
    professional: l.professionals ? { id: l.professionals.id, name: l.professionals.name } : null,
    price: l.price,
    payment_status: l.payment_status,
    payment_method: l.payment_method,
    paid_at: l.paid_at,
    notes: l.notes,
    created_at: l.created_at,
    updated_at: l.updated_at,
  }
}

function dadosDaMensagem(l: Linha): DadosMensagem {
  return {
    agendamentoId: l.id,
    clienteNome: l.customers?.name ?? "",
    clienteTelefone: l.customers?.phone?.replace(/\D/g, "") || null,
    profissionalNome: l.professionals?.name ?? null,
    profissionalTelefone: l.professionals?.phone ?? null,
    servicoTitulo: l.services?.title ?? null,
    duracaoMinutos: l.services ? l.services.duration_minutes || 30 : null,
    preco: l.price,
    observacao: l.notes,
    inicio: new Date(l.start_time),
  }
}

/** E4: toda escrita deixa uma linha em appointment_logs. Falha no log não desfaz a escrita. */
async function registrarLog(
  db: Db,
  ator: Ator,
  l: { id: string; customer_id: string },
  action: string,
  detalhe?: string | null
) {
  const { error } = await db.from("appointment_logs").insert({
    appointment_id: l.id,
    customer_id: l.customer_id,
    action,
    source: ator.origem,
    raw_message: detalhe ?? null,
    push_name: ator.pushName ?? null,
  })

  if (error) console.error("[domain:registrarLog]", error)
}

/**
 * Envia se o ator permite e o cliente tem telefone. Falha de envio NUNCA
 * desfaz a escrita: o agendamento já mudou, então só loga. Devolve se saiu.
 */
async function notificar(
  ator: Ator,
  telefone: string | null | undefined,
  mensagem: () => string,
  contexto: ContextoNotificacao = { clienteCriado: false }
) {
  if (!ator.podeNotificar || !telefone) return false

  try {
    if (!(await ator.podeNotificar(contexto))) {
      console.warn("[domain:notificar] Envio recusado pelo ator (teto ou cliente novo); mensagem não enviada.", {
        organizationId: ator.organizationId,
      })
      return false
    }

    const resultado = await sendWhatsAppMessage({
      phone: telefone,
      message: mensagem(),
      organizationId: ator.organizationId,
    })

    if (!resultado?.success) {
      console.error("[domain:notificar] Falha ao enviar WhatsApp.", resultado)
    }

    return !!resultado?.success
  } catch (error) {
    console.error("[domain:notificar]", error)
    return false
  }
}

async function carregarTemplates(db: Db, orgId: string) {
  const { data, error } = await db
    .from("organization_settings")
    .select("msg_appointment_pending, msg_appointment_created, msg_appointment_canceled")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) console.error("[domain:carregarTemplates]", error)

  return data
}

type ErroDeBanco = { code?: string; message?: string }

function erroDeEscrita(funcao: string, error: ErroDeBanco): never {
  // A exclusion constraint é a garantia final contra corrida entre dois pedidos.
  if (error.code === "23P01") {
    throw new DomainError("SLOT_UNAVAILABLE", "Este horário acabou de ser ocupado. Por favor, escolha outro.")
  }

  console.error(`[domain:${funcao}]`, error)
  throw error
}

// ---------------------------------------------------------------------------
// 6.1 Criar
// ---------------------------------------------------------------------------

export type EntradaCriacao = {
  cliente: { id: string } | NovoCliente
  profissionalId: string
  servicoId: string
  inicio: Date // já convertido por horaLocalParaUtc
  observacao?: string | null
  status: "pending" | "scheduled" | "confirmed"
  pagamento?: { metodo: string | null; status: "pending" | "paid" } // só painel; demais = pending/null
  /** Política do add-on de autoatendimento: soma ao "agora" do corte de horário. */
  antecedenciaMinutos?: number
}

// Status inicial que cada canal pode criar (tabela "Quem pode o quê", §5).
const STATUS_INICIAL: Record<Canal, Array<EntradaCriacao["status"]>> = {
  painel: ["scheduled"],
  api: ["pending", "scheduled", "confirmed"],
  publico: ["pending"],
  autoatendimento: ["pending"],
  whatsapp_webhook: [],
}

export async function criarAgendamento(
  db: Db,
  ator: Ator,
  entrada: EntradaCriacao
): Promise<{ agendamento: AgendamentoCompleto; clienteCriado: boolean; notificado: boolean }> {
  const orgId = ator.organizationId

  if (!STATUS_INICIAL[ator.canal].includes(entrada.status)) {
    throw new DomainError("VALIDATION_ERROR", "Status inicial não permitido para este canal.")
  }

  // Só o painel registra pagamento na criação; nos demais canais é sempre pending/null.
  const pagamento =
    ator.canal === "painel" && entrada.pagamento ? entrada.pagamento : { metodo: null, status: "pending" as const }

  if (pagamento.metodo !== null && !(METODOS_PAGAMENTO as readonly string[]).includes(pagamento.metodo)) {
    throw new DomainError("VALIDATION_ERROR", "Forma de pagamento inválida.")
  }

  const [servico, profissional] = await Promise.all([
    exigirServicoAtivo(db, orgId, entrada.servicoId),
    exigirProfissionalAtivo(db, orgId, entrada.profissionalId),
  ])

  const agora = new Date()
  const fim = new Date(entrada.inicio.getTime() + servico.duracaoMinutos * 60000)

  await validarHorario(db, {
    orgId,
    profissionalId: profissional.id,
    inicio: entrada.inicio,
    duracaoMinutos: servico.duracaoMinutos,
    naoAntesDe: corteDeHorario(ator.canal, agora, entrada.antecedenciaMinutos),
    exigirGrade: exigeGrade(ator.canal),
  })

  // O documento só é obrigatório onde já era (painel e público); a API v1 não exigia.
  const cliente = await resolverCliente(db, orgId, entrada.cliente, {
    exigirDocumento: ator.canal === "painel" || ator.canal === "publico",
  })

  const { data: criado, error } = await db
    .from("appointments")
    .insert({
      organization_id: orgId,
      customer_id: cliente.id,
      professional_id: profissional.id,
      service_id: servico.id,
      start_time: entrada.inicio.toISOString(),
      end_time: fim.toISOString(),
      notes: entrada.observacao ?? null,
      price: servico.preco ?? 0,
      payment_status: pagamento.status,
      payment_method: pagamento.metodo,
      paid_at: pagamento.status === "paid" ? agora.toISOString() : null,
      status: entrada.status,
    })
    .select("id")
    .single()

  if (error || !criado) return erroDeEscrita("criarAgendamento", error ?? { message: "insert vazio" })

  const linha = await carregar(db, orgId, criado.id)

  await registrarLog(db, ator, linha, "created")

  let notificado = false

  if (ator.podeNotificar) {
    const templates = await carregarTemplates(db, orgId)
    const pendente = entrada.status === "pending"
    const template = pendente ? templates?.msg_appointment_pending : templates?.msg_appointment_created

    notificado = await notificar(
      ator,
      linha.customers?.phone,
      () => mensagemCriacao(pendente, template, dadosDaMensagem(linha)),
      { clienteCriado: cliente.criado }
    )
  }

  return { agendamento: completo(linha), clienteCriado: cliente.criado, notificado }
}

// ---------------------------------------------------------------------------
// 6.2 Editar / remarcar
// ---------------------------------------------------------------------------

export type EntradaEdicao = {
  inicio?: Date
  profissionalId?: string
  servicoId?: string
  observacao?: string | null
  /** Política do add-on de autoatendimento: soma ao "agora" do corte de horário (mesmo papel que em EntradaCriacao). */
  antecedenciaMinutos?: number
}

export async function editarAgendamento(
  db: Db,
  ator: Ator,
  id: string,
  entrada: EntradaEdicao
): Promise<{ agendamento: AgendamentoCompleto; notificado: boolean }> {
  const orgId = ator.organizationId
  const atual = await carregar(db, orgId, id)
  const statusAtual = atual.status as Status

  if (!podeEditar(statusAtual)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Agendamento ${rotulo(statusAtual).toLowerCase()} não pode ser alterado.`
    )
  }

  // No autoatendimento o serviço não muda: o cliente só remarca o horário.
  const servicoId = (ator.canal === "autoatendimento" ? undefined : entrada.servicoId) ?? atual.service_id
  const profissionalId = entrada.profissionalId ?? atual.professional_id

  if (!servicoId || !profissionalId) {
    throw new DomainError("VALIDATION_ERROR", "Agendamento sem serviço ou profissional: informe ambos.")
  }

  const [servico, profissional] = await Promise.all([
    exigirServicoAtivo(db, orgId, servicoId),
    exigirProfissionalAtivo(db, orgId, profissionalId),
  ])

  const inicio = entrada.inicio ?? new Date(atual.start_time)

  // Só conta como remarcação o que o pedido de fato mudou. Comparar o fim
  // recalculado com o gravado tratava como remarcação qualquer edição de
  // observação quando a duração do serviço tinha mudado no cadastro depois do
  // agendamento: revalidava a agenda (recusando agendamento já passado),
  // regravava o fim, zerava lembretes e avisava o cliente de uma mudança que
  // não houve.
  const mudouHorario =
    inicio.getTime() !== new Date(atual.start_time).getTime() ||
    profissional.id !== atual.professional_id ||
    servico.id !== atual.service_id

  // Sem remarcação, o fim gravado fica como está (a duração do atendimento
  // marcado não acompanha mudança posterior no cadastro do serviço).
  const fim = mudouHorario ? new Date(inicio.getTime() + servico.duracaoMinutos * 60000) : new Date(atual.end_time)

  if (mudouHorario) {
    await validarHorario(db, {
      orgId,
      profissionalId: profissional.id,
      inicio,
      duracaoMinutos: servico.duracaoMinutos,
      naoAntesDe: corteDeHorario(ator.canal, new Date(), entrada.antecedenciaMinutos),
      exigirGrade: exigeGrade(ator.canal),
      // Remarcar para um horário que se sobrepõe ao atual não conflita consigo mesmo.
      ignorarAgendamentoId: id,
    })
  }

  const mudancas: Record<string, unknown> = {
    start_time: inicio.toISOString(),
    end_time: fim.toISOString(),
    professional_id: profissional.id,
    service_id: servico.id,
    updated_at: new Date().toISOString(),
  }

  if (entrada.observacao !== undefined) mudancas.notes = entrada.observacao

  // Horário novo: o cron de lembretes precisa avisar de novo.
  if (mudouHorario) {
    mudancas.reminder_sent_at = null
    mudancas.reminder_morning_sent_at = null
  }

  // O "confirmado" valia para o horário antigo (D8): o cliente que remarca volta a pedido.
  if (ator.canal === "autoatendimento") mudancas.status = "pending"

  // E6: só grava se o status continua o que lemos.
  const { data: escrito, error } = await db
    .from("appointments")
    .update(mudancas)
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("status", statusAtual)
    .select("id")

  if (error) return erroDeEscrita("editarAgendamento", error)

  if (!escrito || escrito.length === 0) {
    throw new DomainError("INVALID_TRANSITION", MSG_ALTERADO_POR_OUTRA_PESSOA)
  }

  const linha = await carregar(db, orgId, id)

  await registrarLog(
    db,
    ator,
    linha,
    mudouHorario ? "rescheduled" : "updated",
    mudouHorario ? `${utcParaHoraLocal(atual.start_time)} -> ${utcParaHoraLocal(linha.start_time)}` : null
  )

  const notificado = mudouHorario
    ? await notificar(ator, linha.customers?.phone, () => mensagemAlteracao(dadosDaMensagem(linha)))
    : false

  return { agendamento: completo(linha), notificado }
}

// ---------------------------------------------------------------------------
// 6.3 Mudar status
// ---------------------------------------------------------------------------

// Canais em que quem age é o CLIENTE (não o tenant): só "vou" e "cancelar"
// (tabela "Quem pode o quê", §5). Confirmar pedido pendente é do tenant.
const CANAIS_DO_CLIENTE: Canal[] = ["autoatendimento", "whatsapp_webhook"]

function canalPodeTransicionar(canal: Canal, de: Status, para: Status) {
  if (canal === "publico") return false
  if (!CANAIS_DO_CLIENTE.includes(canal)) return true
  if (para === "confirmed") return de === "scheduled"

  return para === "canceled"
}

export async function mudarStatus(
  db: Db,
  ator: Ator,
  id: string,
  para: Status,
  opcoes?: {
    motivo?: string
    /** O tenant está respondendo a um pedido pendente: usa os textos de aprovação/recusa. */
    aoResponderPedido?: boolean
  }
): Promise<{ agendamento: AgendamentoCompleto; alterado: boolean; notificado: boolean }> {
  const orgId = ator.organizationId

  if (!ehStatus(para)) throw new DomainError("VALIDATION_ERROR", "Status inválido.")

  const atual = await carregar(db, orgId, id)
  const statusAtual = atual.status as Status

  // Repetir o status atual é idempotente: nem escreve, nem loga, nem avisa.
  if (para === statusAtual) {
    return { agendamento: completo(atual), alterado: false, notificado: false }
  }

  const inicio = new Date(atual.start_time)

  if (
    !podeTransicionar(statusAtual, para, inicio, new Date()) ||
    !canalPodeTransicionar(ator.canal, statusAtual, para)
  ) {
    // Falta marcada antes do horário: a transição existe, só não é hora ainda.
    const cedo = para === "no_show" && TRANSICOES[statusAtual]?.includes(para)

    throw new DomainError(
      "INVALID_TRANSITION",
      cedo
        ? "Só é possível marcar falta depois do horário do agendamento."
        : `Não é possível mudar de ${rotulo(statusAtual)} para ${rotulo(para)}.`
    )
  }

  // E6: se alguém mudou o agendamento entre a leitura e a escrita, 0 linhas.
  const { data: escrito, error } = await db
    .from("appointments")
    .update({ status: para, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("status", statusAtual)
    .select("id")

  if (error) return erroDeEscrita("mudarStatus", error)

  if (!escrito || escrito.length === 0) {
    throw new DomainError("INVALID_TRANSITION", MSG_ALTERADO_POR_OUTRA_PESSOA)
  }

  const linha = await carregar(db, orgId, id)

  await registrarLog(db, ator, linha, para, opcoes?.motivo)

  let notificado = false

  if (ator.podeNotificar && (para === "canceled" || para === "confirmed")) {
    const dados = dadosDaMensagem(linha)
    let organizacaoNome: string | null = null
    let templateCancelamento: string | null | undefined

    if (opcoes?.aoResponderPedido) {
      const { data } = await db.from("organizations").select("name").eq("id", orgId).maybeSingle()
      organizacaoNome = data?.name ?? null
    } else if (para === "canceled") {
      templateCancelamento = (await carregarTemplates(db, orgId))?.msg_appointment_canceled
    }

    notificado = await notificar(ator, linha.customers?.phone, () => {
      if (para === "confirmed") {
        return opcoes?.aoResponderPedido ? mensagemPedidoAprovado(dados, organizacaoNome) : mensagemConfirmacao(dados)
      }

      return opcoes?.aoResponderPedido
        ? mensagemPedidoRecusado(dados, organizacaoNome)
        : mensagemCancelamento(templateCancelamento, dados)
    })
  }

  return { agendamento: completo(linha), alterado: true, notificado }
}

// ---------------------------------------------------------------------------
// 6.4 Pagamento
// ---------------------------------------------------------------------------

export async function registrarPagamento(
  db: Db,
  ator: Ator,
  id: string,
  entrada: { metodo: string; status: StatusPagamento }
): Promise<{ agendamento: AgendamentoCompleto; alterado: boolean }> {
  const orgId = ator.organizationId

  if (!(METODOS_PAGAMENTO as readonly string[]).includes(entrada.metodo)) {
    throw new DomainError("VALIDATION_ERROR", "Forma de pagamento inválida.")
  }

  if (!STATUS_DE_PAGAMENTO.includes(entrada.status)) {
    throw new DomainError("VALIDATION_ERROR", "Status de pagamento inválido.")
  }

  const atual = await carregar(db, orgId, id)
  const statusAtual = atual.status as Status

  if (!podeReceberPagamento(statusAtual)) {
    throw new DomainError("INVALID_TRANSITION", `Agendamento ${rotulo(statusAtual).toLowerCase()} não recebe pagamento.`)
  }

  // Já pago e pedido pago: não reescreve paid_at nem o método (antes cada clique sobrescrevia).
  if (atual.payment_status === "paid" && entrada.status === "paid") {
    return { agendamento: completo(atual), alterado: false }
  }

  const agora = new Date().toISOString()

  const mudancas: Record<string, unknown> = {
    payment_status: entrada.status,
    payment_method: entrada.metodo,
    updated_at: agora,
  }

  // paid grava a data; pending zera; partially_paid e refunded mantêm a que havia.
  if (entrada.status === "paid") mudancas.paid_at = agora
  if (entrada.status === "pending") mudancas.paid_at = null

  const { data: escrito, error } = await db
    .from("appointments")
    .update(mudancas)
    .eq("id", id)
    .eq("organization_id", orgId)
    .eq("status", statusAtual)
    .select("id")

  if (error) return erroDeEscrita("registrarPagamento", error)

  if (!escrito || escrito.length === 0) {
    throw new DomainError("INVALID_TRANSITION", MSG_ALTERADO_POR_OUTRA_PESSOA)
  }

  const linha = await carregar(db, orgId, id)

  await registrarLog(db, ator, linha, `payment:${entrada.status}`, entrada.metodo)

  return { agendamento: completo(linha), alterado: true }
}
