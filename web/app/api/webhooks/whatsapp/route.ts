import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// --- CONFIGURAÇÕES ---
const EVOLUTION_API_URL = "https://heterodoxly-unchastened-nichole.ngrok-free.dev" 
const EVOLUTION_API_KEY = "medagenda123" 

const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'vou', 'comparecer', 'ok', '👍', 'diga']
const CANCELLATION_KEYWORDS = ['não', 'nao', 'cancelar', 'cancela', 'não vou', 'nao vou', 'remarcar', 'outro dia', 'imprevisto']
const WORKING_HOURS = [9, 10, 11, 14, 15, 16, 17]

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { event, data, instance } = payload
    
    // 1. Ignora eventos irrelevantes
    if (event !== 'messages.upsert' && event !== 'messages.update') {
      return NextResponse.json({ message: 'Ignored event' }, { status: 200 })
    }

    const messageData = data.message || data
    const key = data.key || messageData.key || {}

    // --- IDENTIFICAÇÃO DO NÚMERO (Lógica Corrigida) ---
    
    // Passo 1: O candidato principal é sempre o remoteJid (quem está conversando comigo)
    let targetJid = key.remoteJid || data.remoteJid || ''

    // Passo 2: Se o principal for um LID (ID interno), tentamos o Alternativo
    if (targetJid.includes('@lid') && key.remoteJidAlt) {
        targetJid = key.remoteJidAlt
    }

    // Passo 3: Segurança - Se ainda for LID, ou vazio, ignoramos (não dá para saber quem é)
    if (!targetJid || targetJid.includes('@lid')) {
        console.warn(`⚠️ Ignorado: JID inválido ou LID sem alternativo (${targetJid})`)
        return NextResponse.json({ message: 'Invalid JID' }, { status: 200 })
    }

    // Passo 4: Se for mensagem enviada PELA clínica (outgoing), ignoramos
    if (key.fromMe || targetJid.includes('@g.us')) {
        return NextResponse.json({ message: 'Ignored group/self' }, { status: 200 })
    }

    // Limpeza: Pega os últimos 8 dígitos
    const phoneDigits = targetJid.replace(/\D/g, '')
    const searchPhone = phoneDigits.slice(-8)

    // 2. Extrai o Conteúdo da Mensagem
    let content = ''
    if (messageData.conversation) content = messageData.conversation
    else if (messageData.extendedTextMessage?.text) content = messageData.extendedTextMessage.text
    else if (messageData.pollUpdates?.[0]?.vote?.selectedOptions?.[0]?.name) {
        content = messageData.pollUpdates[0].vote.selectedOptions[0].name
    }

    if (!content) return NextResponse.json({ message: 'No content' }, { status: 200 })
    
    console.log(`📩 Mensagem de final ...${searchPhone}: "${content}"`)

    const lowerContent = content.toLowerCase().trim()
    const isConfirmation = CONFIRMATION_KEYWORDS.some(w => lowerContent.includes(w))
    const isCancellation = CANCELLATION_KEYWORDS.some(w => lowerContent.includes(w))

    if (!isConfirmation && !isCancellation) {
        return NextResponse.json({ message: 'Unknown command' }, { status: 200 })
    }

    // 3. Banco de Dados
    const supabase = createAdminClient()

    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, organization_id')
        .ilike('phone', `%${searchPhone}%`)
        .limit(1)
        .single()

    if (!customer) {
        console.warn(`⚠️ Cliente final ...${searchPhone} não encontrado no banco.`)
        return NextResponse.json({ message: 'Customer not found' }, { status: 200 })
    }

    // Busca agendamentos recentes (últimas 24h) ou futuros
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)

    const { data: appointment } = await supabase
        .from('appointments')
        .select('id, start_time, organization_id')
        .eq('customer_id', customer.id)
        .in('status', ['scheduled', 'arrived', 'confirmed']) 
        .gte('start_time', yesterday.toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single()

    if (!appointment) {
        return NextResponse.json({ message: 'No appointment found' }, { status: 200 })
    }

    // --- BUSCA O TEMPLATE DE RESPOSTA NO BANCO ---
    // (Agora usamos o texto que você salvou na tela de Configurações!)
    const { data: template } = await supabase
        .from('message_templates')
        .select('content')
        .eq('organization_id', appointment.organization_id)
        .eq('type', 'cancellation_response')
        .single()

    // --- AÇÃO: CONFIRMAR ---
    if (isConfirmation) {
        await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id)
        console.log(`✅ Confirmado com sucesso: ${customer.name}`)
        return NextResponse.json({ success: true }, { status: 200 })
    }

    // --- AÇÃO: CANCELAR E OFERECER HORÁRIOS ---
    if (isCancellation) {
        // 1. Cancela
        await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id)
        console.log(`🚫 Cancelado por solicitação: ${customer.name}`)

        // 2. Busca Horários Livres Amanhã
        const tomorrow = addDays(new Date(), 1)
        const startOfDay = new Date(tomorrow.setHours(0,0,0,0)).toISOString()
        const endOfDay = new Date(tomorrow.setHours(23,59,59,999)).toISOString()

        const { data: busySlots } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('organization_id', appointment.organization_id)
            .neq('status', 'canceled')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)

        const busyTimes = new Set(busySlots?.map(a => new Date(a.start_time).getHours()))

        const freeSlots = WORKING_HOURS
            .filter(hour => !busyTimes.has(hour))
            .slice(0, 3)
            .map(hour => `${hour}:00`)

        // 3. Monta a Mensagem (Usando o Template do Banco ou Fallback)
        let textMessage = template?.content || `Agendamento cancelado. Horários livres amanhã: {{horarios_livres}}`
        
        // Substitui a variável {{horarios_livres}} pela lista real
        const slotsText = freeSlots.map(h => `▪️ ${h}`).join('\n')
        textMessage = textMessage.replace('{{horarios_livres}}', slotsText)

        const apiUrl = `${EVOLUTION_API_URL}/message/sendText/${instance}`
        
        await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: targetJid.replace('@s.whatsapp.net', '').replace(/@lid/g, ''),
                text: textMessage
            })
        })
        
        return NextResponse.json({ success: true }, { status: 200 })
    }

  } catch (error) {
    console.error("❌ Erro Fatal no Webhook:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}