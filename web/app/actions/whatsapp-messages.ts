'use server'

import { createClient } from "@/utils/supabase/server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://127.0.0.1:8082"
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY || "medagenda123"

export async function sendAppointmentConfirmation(appointmentId: string) {
  const supabase = await createClient()

  // 1. Busca os dados COMPLETOS
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      *,
      customers ( name, phone ),
      services ( title, duration_minutes ),
      profiles ( full_name ),
      organizations ( slug, evolution_api_url, evolution_api_key )
    `)
    .eq('id', appointmentId)
    .single() as any

  if (error || !appointment) {
    console.error("❌ Erro ao buscar dados para WhatsApp:", error)
    return { error: "Agendamento não encontrado" }
  }

  // 2. Validações
  if (!appointment.customers?.phone) return { error: "Cliente sem telefone" }
  if (!appointment.organizations?.slug) return { error: "Organização sem instância WhatsApp" }

  // 3. Configuração
  const instanceName = appointment.organizations.slug
  const EVOLUTION_URL = appointment.organizations.evolution_api_url || DEFAULT_EVOLUTION_URL
  const API_KEY = appointment.organizations.evolution_api_key || GLOBAL_API_KEY
  
  // 4. Formata Telefone
  const rawPhone = appointment.customers.phone.replace(/\D/g, "")
  const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`

  // 5. Prepara Dados da Mensagem
  const dateObj = new Date(appointment.start_time)
  const dateStr = format(dateObj, "dd/MM 'às' HH:mm", { locale: ptBR })
  const profissional = appointment.profiles?.full_name || 'Clínica'
  const procedimento = appointment.services?.title || 'Consulta'
  const primeiroNome = appointment.customers.name.split(' ')[0]

  // MENSAGEM 1: Texto Informativo
  const messageText = `Olá *${primeiroNome}*! 👋

Seu agendamento foi realizado com sucesso:

🏥 *${procedimento}*
📅 *${dateStr}*
👨‍⚕️ *${profissional}*

📍 _Chegue com 10 minutos de antecedência._
Confirme sua presença abaixo 👇`

  console.log(`📤 Enviando confirmação para ${phone}...`)

  try {
    // PASSO A: Envia o Texto
    await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({
        number: phone,
        text: messageText
      })
    })

    // Pequeno delay para garantir a ordem
    await new Promise(r => setTimeout(r, 500))


  } catch (err) {
    console.error("❌ Erro de Conexão:", err)
    return { error: "Erro de conexão" }
  }
}

export async function sendAppointmentCancellation(appointmentId: string) {
  const supabase = await createClient()

  // 1. Busca dados
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      customers ( name, phone ),
      services ( title ),
      organizations ( slug, evolution_api_url, evolution_api_key )
    `)
    .eq('id', appointmentId)
    .single() as any

  if (!appointment?.customers?.phone || !appointment?.organizations?.slug) return

  // 2. Configura API
  const instanceName = appointment.organizations.slug
  const EVOLUTION_URL = appointment.organizations.evolution_api_url || DEFAULT_EVOLUTION_URL
  const API_KEY = appointment.organizations.evolution_api_key || GLOBAL_API_KEY
  
  const rawPhone = appointment.customers.phone.replace(/\D/g, "")
  const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`

  // 3. Monta Mensagem
  const dateObj = new Date(appointment.start_time)
  const dateStr = format(dateObj, "dd/MM 'às' HH:mm", { locale: ptBR })
  const primeiroNome = appointment.customers.name.split(' ')[0]

  const message = `Olá *${primeiroNome}*,

⚠️ *Agendamento Cancelado*

O procedimento *${appointment.services?.title}* previsto para *${dateStr}* foi cancelado.

Se precisar reagendar, entre em contato conosco.
Obrigado.`

  // 4. Envia
  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ number: phone, text: message })
    })
  } catch (err) {
    console.error("Erro ao enviar cancelamento:", err)
  }
}