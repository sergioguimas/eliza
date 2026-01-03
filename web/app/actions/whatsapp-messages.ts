'use server'

import { createClient } from "@/utils/supabase/server"

export async function sendAppointmentConfirmation(appointmentId: string) {
  const supabase = await createClient()

  // 1. Busca os dados da consulta e as configurações da API
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patient_id(name, phone),
      organization:organizations_id(slug, evolution_url, evolution_apikey)
    `)
    .eq('id', appointmentId)
    .single() as any

  if (error || !appointment) return { error: "Agendamento não encontrado." }

  const org = appointment.organization
  const patient = appointment.patient
  const dateStr = new Date(appointment.date).toLocaleDateString('pt-BR')
  
  // URL da Evolution para envio de botões
  const url = `${org.evolution_url}/message/sendButtons/${org.slug}`

  const body = {
    number: patient.phone.replace(/\D/g, ''), // Limpa caracteres do telefone
    buttonText: "Confirmar agora",
    description: `Olá ${patient.name}, sua consulta para *${appointment.procedure}* foi marcada!\n\n📅 Data: ${dateStr}\n⏰ Horário: ${appointment.time}\n\nPodemos confirmar sua presença?`,
    title: "Confirmação de Agendamento",
    footer: "Assistente Eliza",
    buttons: [
      {
        buttonId: `confirm_${appointmentId}`,
        buttonText: { displayText: "✅ Confirmar" },
        type: 1
      },
      {
        buttonId: `reschedule_${appointmentId}`,
        buttonText: { displayText: "⏳ Reagendar" },
        type: 1
      }
    ]
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': org.evolution_apikey
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) throw new Error("Falha ao enviar mensagem")
    
    return { success: true }
  } catch (err) {
    console.error("❌ Erro no disparo:", err)
    return { error: "Erro ao conectar com a API de WhatsApp" }
  }
}