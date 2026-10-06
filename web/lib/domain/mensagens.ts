import "server-only"

import { utcParaHoraLocal } from "./tempo"

/**
 * Textos de WhatsApp de agendamento, num lugar só. Antes viviam em
 * create-appointment, update-appointment, cancel/delete-appointment,
 * handle-appointment-request, no webhook e em lib/api/domain/appointments, com
 * redações parecidas e levemente diferentes. Aqui só há funções puras: quem
 * envia (agendamentos.ts) carrega os templates da org e chama estas.
 */

export function renderMessageTemplate(
  template: string | null | undefined,
  variables: Record<string, string | number | null | undefined>
) {
  if (!template) return null

  return template.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, key) => {
    const value = variables[key]
    return value === null || value === undefined ? "" : String(value)
  })
}

export type DadosMensagem = {
  agendamentoId: string
  clienteNome: string
  clienteTelefone: string | null
  profissionalNome: string | null
  profissionalTelefone: string | null
  servicoTitulo: string | null
  duracaoMinutos: number | null
  preco: number | null
  observacao: string | null
  inicio: Date
}

/** "dd/mm/aaaa" e "HH:mm" no relógio de SP, a partir do `tempo.ts` (nada de fuso aqui). */
function diaEHora(inicio: Date) {
  const [data, hora] = utcParaHoraLocal(inicio).split("T")
  const [a, m, d] = data.split("-")

  return { dia: `${d}/${m}/${a}`, hora }
}

const servicoOuPadrao = (d: DadosMensagem) => d.servicoTitulo || "atendimento"

/** Variáveis aceitas pelos templates da org (inclui os apelidos antigos). */
function variaveis(d: DadosMensagem) {
  const { dia, hora } = diaEHora(d.inicio)
  const dataHora = `${dia}, ${hora}`

  return {
    appointment_id: d.agendamentoId,

    customer_name: d.clienteNome,
    customer_phone: d.clienteTelefone,

    professional_name: d.profissionalNome,
    professional_phone: d.profissionalTelefone,

    service_title: d.servicoTitulo,
    service_name: d.servicoTitulo,

    appointment_datetime: dataHora,
    start_time: dataHora,

    duration_minutes: d.duracaoMinutos,
    price: d.preco,
    notes: d.observacao,

    // aliases antigos dos templates
    name: d.clienteNome,
    service: d.servicoTitulo,
    professional: d.profissionalNome,
    date: dia,
    time: hora,
  }
}

/** Agendamento criado: `pendente` usa msg_appointment_pending, senão msg_appointment_created. */
export function mensagemCriacao(pendente: boolean, template: string | null | undefined, d: DadosMensagem) {
  const { dia, hora } = diaEHora(d.inicio)
  const servico = d.servicoTitulo ?? ""

  const padrao = pendente
    ? `Olá ${d.clienteNome}, sua solicitação de ${servico} foi recebida para ${dia} às ${hora}. Em breve confirmaremos seu atendimento.`
    : `Olá ${d.clienteNome}, seu ${servico} foi marcado com sucesso para ${dia} às ${hora}. Aguardamos por você!`

  return renderMessageTemplate(template, variaveis(d)) || padrao
}

export function mensagemAlteracao(d: DadosMensagem) {
  const { dia, hora } = diaEHora(d.inicio)

  return `Olá ${d.clienteNome}, atenção: Seu agendamento de *${servicoOuPadrao(d)}* foi *alterado* para dia ${dia} às ${hora}.`
}

/** Cancelamento: template da org (msg_appointment_canceled) ou o texto padrão. */
export function mensagemCancelamento(template: string | null | undefined, d: DadosMensagem) {
  const { dia, hora } = diaEHora(d.inicio)

  return (
    renderMessageTemplate(template, variaveis(d)) ||
    `Olá ${d.clienteNome}, seu agendamento de *${servicoOuPadrao(d)}* para o dia ${dia} às ${hora} foi *cancelado*.`
  )
}

/** Confirmação feita pelo tenant sobre um agendamento que já estava marcado. */
export function mensagemConfirmacao(d: DadosMensagem) {
  const { dia, hora } = diaEHora(d.inicio)

  return `✅ *Agendamento confirmado!*\n\nOlá ${d.clienteNome}, seu horário para *${servicoOuPadrao(d)}* em ${dia} às ${hora} está confirmado.`
}

/** Tenant aprovou um pedido pendente (fila de solicitações do dashboard). */
export function mensagemPedidoAprovado(d: DadosMensagem, organizacaoNome: string | null) {
  const servico = d.servicoTitulo || "serviço"
  const org = organizacaoNome || "nossa clínica"

  return `✅ *Agendamento Confirmado!*\n\nOlá ${d.clienteNome}, o seu horário para *${servico}* em *${org}* foi aprovado com sucesso. Esperamos por si!`
}

/** Tenant recusou um pedido pendente. */
export function mensagemPedidoRecusado(d: DadosMensagem, organizacaoNome: string | null) {
  const servico = d.servicoTitulo || "serviço"
  const org = organizacaoNome || "nossa clínica"

  return `❌ *Atualização de Agendamento*\n\nOlá ${d.clienteNome}, infelizmente não conseguimos confirmar o seu pedido de horário para *${servico}* em *${org}*. Por favor, entre em contacto para sugerirmos uma nova data.`
}

/** Resposta do webhook quando o cliente confirma pelo WhatsApp. */
export function respostaWebhookConfirmacao(primeiroNome: string) {
  return `✅ *Confirmado, ${primeiroNome || "tudo certo"}!* Já deixei seu agendamento confirmado na agenda. Te aguardamos!`
}

/** Resposta do webhook quando o cliente cancela pelo WhatsApp (template da org só com {name}). */
export function respostaWebhookCancelamento(template: string | null | undefined, primeiroNome: string) {
  return (
    renderMessageTemplate(template, { name: primeiroNome }) ||
    `👌 *Entendido, ${primeiroNome || "tudo certo"}.* O agendamento foi cancelado. Quando quiser remarcar, é só chamar!`
  )
}
