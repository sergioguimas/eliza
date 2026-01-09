import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, format } from 'date-fns'

// Variáveis de ambiente como Fallback (caso a org não tenha configurado)
const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY

// Adicionei '1' e '2' para bater com a mensagem do Cron Job
const CONFIRMATION_KEYWORDS = ['1', 'sim', 'confirmar', 'confirmo', 'vou', 'comparecer', 'ok', '👍']
const CANCELLATION_KEYWORDS = ['2', 'não', 'nao', 'cancelar', 'cancela', 'não vou', 'nao vou', 'remarcar']

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { event, data, instance } = payload
    
    // 1. Ignora eventos irrelevantes
    if (event !== 'messages.upsert') {
      return NextResponse.json({ message: 'Ignored event' }, { status: 200 })
    }

    const messageData = data.message || data
    const key = data.key || messageData.key || {}

    // --- IDENTIFICAÇÃO DO NÚMERO ---
    let targetJid = key.remoteJid || data.remoteJid || ''

    if (targetJid.includes('@lid') && key.remoteJidAlt) targetJid = key.remoteJidAlt
    if (!targetJid || targetJid.includes('@lid')) return NextResponse.json({ message: 'Invalid JID' }, { status: 200 })
    if (key.fromMe || targetJid.includes('@g.us')) return NextResponse.json({ message: 'Ignored group/self' }, { status: 200 })

    const phoneDigits = targetJid.replace(/\D/g, '')
    const searchPhone = phoneDigits.slice(-8) // Pega os últimos 8 dígitos para busca flexível

    // 2. Extrai o Conteúdo
    let content = ''
    if (messageData.conversation) content = messageData.conversation
    else if (messageData.extendedTextMessage?.text) content = messageData.extendedTextMessage.text

    if (!content) return NextResponse.json({ message: 'No content' }, { status: 200 })
    
    const lowerContent = content.toLowerCase().trim()
    
    // Verifica intenção (Se não for 1/Sim ou 2/Não, ignora)
    const isConfirmation = CONFIRMATION_KEYWORDS.some(w => lowerContent === w || lowerContent.startsWith(w + ' '))
    const isCancellation = CANCELLATION_KEYWORDS.some(w => lowerContent === w || lowerContent.startsWith(w + ' '))

    if (!isConfirmation && !isCancellation) {
        return NextResponse.json({ message: 'Not a command' }, { status: 200 })
    }

    // 3. Busca no Banco
    const supabase = createAdminClient()

    // A. Busca Cliente
    const { data: customer } = await supabase
        .from('customers')
        .select('id, name')
        .ilike('phone', `%${searchPhone}%`)
        .limit(1)
        .single()

    if (!customer) return NextResponse.json({ message: 'Customer not found' }, { status: 200 })

    // B. Busca Agendamento Recente + Configurações da Org
    // Aqui está o segredo: Já trazemos as configurações junto!
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)

    const { data: appointment } = await supabase
        .from('appointments')
        .select(`
            id, 
            start_time, 
            status,
            organization_id,
            organizations (
                slug,
                evolution_api_url,
                evolution_api_key,
                organization_settings ( 
                    whatsapp_message_canceled,
                    open_hours_start,
                    open_hours_end
                )
            )
        `)
        .eq('customer_id', customer.id)
        .in('status', ['scheduled', 'confirmed']) // Só mexe se estiver agendado ou confirmado
        .gte('start_time', yesterday.toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single() as any

    if (!appointment) return NextResponse.json({ message: 'No active appointment' }, { status: 200 })

    const org = appointment.organizations
    const settings = org.organization_settings?.[0] || org.organization_settings // Trata array ou objeto

    // Configurações de Envio da Org
    const EVOLUTION_URL = org.evolution_api_url || DEFAULT_EVOLUTION_URL
    const API_KEY = org.evolution_api_key || GLOBAL_API_KEY
    const instanceName = org.slug

    // --- AÇÃO: CONFIRMAR ---
    if (isConfirmation) {
        if (appointment.status === 'confirmed') return NextResponse.json({ message: 'Already confirmed' }, { status: 200 })
        
        await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id)
        
        // Opcional: Enviar mensagem de agradecimento ("Obrigado, confirmado!")
        // Mas por enquanto só confirma silenciosamente no sistema.
        console.log(`✅ Agendamento confirmado via Zap: ${customer.name}`)
        return NextResponse.json({ success: true, action: 'confirmed' }, { status: 200 })
    }

    // --- AÇÃO: CANCELAR ---
    if (isCancellation) {
        // 1. Atualiza Status
        await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id)
        console.log(`🚫 Agendamento cancelado via Zap: ${customer.name}`)

        // 2. Calcula Horários Livres para sugerir (Básico)
        // Usa o horário configurado na org ou padrão 08-18
        const startHour = parseInt(settings?.open_hours_start?.split(':')[0] || "8")
        const endHour = parseInt(settings?.open_hours_end?.split(':')[0] || "18")
        
        // Cria array de horários possíveis (Ex: [8, 9, 10...])
        const possibleHours = Array.from({ length: endHour - startHour }, (_, i) => i + startHour)

        // Busca ocupados de amanhã
        const tomorrow = addDays(new Date(), 1)
        const startDay = new Date(tomorrow.setHours(0,0,0,0)).toISOString()
        const endDay = new Date(tomorrow.setHours(23,59,59,999)).toISOString()

        const { data: busySlots } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('organization_id', appointment.organization_id)
            .neq('status', 'canceled')
            .gte('start_time', startDay)
            .lte('start_time', endDay)

        const busyTimes = new Set(busySlots?.map(a => new Date(a.start_time).getHours()))

        // Filtra livres e pega 3
        const freeSlots = possibleHours
            .filter(h => !busyTimes.has(h))
            .slice(0, 3)
            .map(h => `${h}:00`)

        // 3. Pega Mensagem Personalizada
        let messageText = settings?.whatsapp_message_canceled || "Agendamento cancelado."
        
        // Se a mensagem tiver a tag {{horarios_livres}}, a gente insere
        // Se não tiver, adicionamos no final se houver horários
        const slotsString = freeSlots.length > 0 
            ? `\n\nHorários livres amanhã:\n` + freeSlots.map(h => `▪️ ${h}`).join('\n')
            : ""

        // Se o usuário configurou a tag no texto:
        if (messageText.includes('{{horarios_livres}}')) {
             // Se tiver horários, substitui. Se não tiver, limpa a tag.
             messageText = messageText.replace('{{horarios_livres}}', slotsString.replace('\n\n', '')) 
        } else {
             // Se não configurou tag, anexa no final
             messageText += slotsString
        }

        // 4. Envia Resposta
        await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
            body: JSON.stringify({
                number: targetJid.replace('@s.whatsapp.net', '').replace(/@lid/g, ''),
                text: messageText
            })
        })

        return NextResponse.json({ success: true, action: 'canceled' }, { status: 200 })
    }

    return NextResponse.json({ message: 'No action taken' }, { status: 200 })

  } catch (error) {
    console.error("❌ Erro no Webhook:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}