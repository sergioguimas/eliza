'use server'

import { createClient } from "@/utils/supabase/server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database } from "@/utils/database.types"

// Função auxiliar para trocar as variáveis {name}, {date}, etc.
function replaceVariables(template: string, data: any) {
  if (!template) return ""
  return template
    .replace(/{name}/g, data.name || "")
    .replace(/{date}/g, data.date || "")
    .replace(/{time}/g, data.time || "")
    .replace(/{service}/g, data.service || "")
    .replace(/{professional}/g, data.professional || "")
}

export async function sendAppointmentConfirmation(appointmentId: string) {
   const supabase = await createClient()

  // 1. Busca os dados COMPLETOS + Configurações de Mensagem
  // (Corrigido para 'professionals' e extraindo o 'error' para não falhar silenciosamente)
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      *,
      customers ( name, phone ),
      services ( title, duration_minutes ),
      professionals ( name ),
      organizations (
        slug,
        evolution_api_url,
        evolution_api_key,
        organization_settings ( msg_appointment_created )
      )
    `)
    .eq('id', appointmentId)
    .single() as any

  // 🚨 DEFESA: Se o banco reclamar de algo, GRITE no log!
  if (error) {
    console.error("❌ [ERR_DB_QUERY] Erro ao buscar dados para WhatsApp:", error.message || error);
    return { error: "Agendamento não encontrado" }
  }

  // 🚨 DEFESA: Se não achou o agendamento, avise em vez de sumir.
  if (!appointment) {
    console.error(`❌ [ERR_NOT_FOUND] Agendamento ID ${appointmentId} veio vazio do banco.`);
    return { error: "Agendamento não encontrado." };
  }

  // 2. Validações
  if (!appointment.customers?.phone) {
    console.error(`❌ [ERR_VALIDATION] Agendamento ${appointmentId} abortado: Cliente sem telefone.`);
    return { error: "Cliente sem telefone" }
  }
  if (!appointment.organizations?.slug) {
    console.error(`❌ [ERR_VALIDATION] Agendamento ${appointmentId} abortado: Organização sem slug.`);
    return { error: "Organização sem instância WhatsApp" }
  }

  // 3. Configuração
  const instanceName = appointment.organizations.slug
  let EVOLUTION_URL = process.env.EVOLUTION_API_URL || appointment.organizations.evolution_api_url || "";
  EVOLUTION_URL = EVOLUTION_URL.replace(/\/$/, ""); // Remove barra extra no final, se houver
  const API_KEY = process.env.EVOLUTION_API_KEY || appointment.organizations.evolution_api_key || "";

  if (!EVOLUTION_URL || !API_KEY) {
    console.error("❌ [ERR_CFG_MISSING] [SendWhatsApp] Falha de Configuração: URL ou API_KEY ausentes.")
    return { error: "Configuração do WhatsApp ausente." }
  }   

  // 4. Formata Telefone e Dados
  const rawPhone = appointment.customers.phone.replace(/\D/g, "")
  const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`
  const dateObj = new Date(appointment.start_time)
  const dateStr = format(dateObj, "dd/MM/yyyy", { locale: ptBR })
  const timeStr = format(dateObj, "HH:mm", { locale: ptBR })
  
  // 5. Pega o template do banco (ou usa um padrão se falhar)
  const settings = appointment.organizations.organization_settings?.[0] || appointment.organizations.organization_settings
  const template = settings?.msg_appointment_created || "Olá {name}, seu agendamento para {service} em {date} às {time} foi confirmado."

  // 6. Monta a mensagem final substituindo as variáveis
  const messageText = replaceVariables(template, {
    name: appointment.customers.name.split(' ')[0],
    date: dateStr,
    time: timeStr,
    service: appointment.services?.title || 'Consulta',
    professional: appointment.professional?.name || 'Profissional'
  })

  console.log(`🔥 [SYS_INFO] [Rastreador] URL: ${EVOLUTION_URL}/message/sendText/${instanceName}`)
  console.log(`📤 [SYS_ACTION] [SendWhatsApp] Enviando confirmação personalizada para ${phone}...`)

  try {
   const response =  await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({
        number: phone,
        text: messageText
      })
    })
    
    if (!response.ok) {
      const errorData = await response.text(); // Pega a resposta de erro da Evolution
      console.error(`❌ [Evolution API Recusou] Status: ${response.status} - Detalhe:`, errorData);
      return { error: "A API do WhatsApp recusou o envio." };
    }    

    console.log("✅ Mensagem enviada com sucesso!");
    return { success: true  }
  }   catch (err: any) {
    console.error("🔥 [SendWhatsApp] CAUSA REAL DA FALHA:", err.cause || err)
    console.error("❌ Erro de Conexão:", err)
    return { error: "Erro crítico de conexão com api" }
  }
}

export async function sendAppointmentCancellation(appointmentId: string) {
  const supabase = await createClient()

  // 1. Busca dados + Template de Cancelamento
  const { data: appointment } = await supabase
    .from('appointments')
    .select(`
      *,
      customers ( name, phone ),
      services ( title ),
      profiles ( full_name ),
      organizations ( 
        slug, 
        evolution_api_url, 
        evolution_api_key,
        organization_settings ( msg_appointment_canceled )
      )
    `)
    .eq('id', appointmentId)
    .single() as any

  if (!appointment?.customers?.phone || !appointment?.organizations?.slug) return

  // 2. Configura API
  const instanceName = appointment.organizations.slug
  const EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || appointment.organizations.evolution_api_url
  const API_KEY = process.env.EVOLUTION_API_KEY || appointment.organizations.evolution_api_key
  
  const rawPhone = appointment.customers.phone.replace(/\D/g, "")
  const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`

  // 3. Dados para substituição
  const dateObj = new Date(appointment.start_time)
  const dateStr = format(dateObj, "dd/MM/yyyy", { locale: ptBR })
  const timeStr = format(dateObj, "HH:mm", { locale: ptBR })

  // 4. Pega Template e Substitui
  const settings = appointment.organizations.organization_settings?.[0] || appointment.organizations.organization_settings
  const template = settings?.msg_appointment_canceled || "Olá {name}, seu agendamento em {date} foi cancelado."

  const message = replaceVariables(template, {
    name: appointment.customers.name.split(' ')[0],
    date: dateStr,
    time: timeStr,
    service: appointment.services?.title || 'Consulta',
    professional: appointment.professional?.name || ''
  }) 

  console.log(`🔥 [Rastreador] URL de Cancelamento: ${EVOLUTION_URL}/message/sendText/${instanceName}`)

  // 5. Envia
  try {
    await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
      body: JSON.stringify({ number: phone, text: message })
    })
  } catch (err: any) {
    console.error("🔥 [SendWhatsApp] CAUSA REAL DA FALHA:", err.cause || err);
    console.log("EVOLUTION_URL:", EVOLUTION_URL)
    console.error("Erro ao enviar cancelamento:", err)
  }
}
