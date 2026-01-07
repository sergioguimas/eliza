import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// --- CONFIGURAÇÕES ---
// Verifique se o link do Ngrok ainda é este (muda se reiniciar o PC)
const EVOLUTION_API_URL = "https://heterodoxly-unchastened-nichole.ngrok-free.dev" 
const EVOLUTION_API_KEY = "medagenda123" 

const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'vou', 'comparecer', 'ok', '👍', 'diga']
const CANCELLATION_KEYWORDS = ['não', 'nao', 'cancelar', 'cancela', 'não vou', 'nao vou', 'remarcar', 'outro dia', 'imprevisto']
const WORKING_HOURS = [9, 10, 11, 14, 15, 16, 17]

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    // 1. Extraímos o 'sender' da raiz também (O segredo está aqui!)
    const { event, data, instance, sender } = payload
    
    if (event !== 'messages.upsert' && event !== 'messages.update') {
      return NextResponse.json({ message: 'Ignored event' }, { status: 200 })
    }

    const messageData = data.message || data
    const key = data.key || messageData.key || {}
    
    // --- LÓGICA DE IDENTIFICAÇÃO DO NÚMERO (TURBINADA) ---
    // Ordem de prioridade:
    // 1. remoteJidAlt (Evolution manda as vezes)
    // 2. sender (Vem na raiz do payload e costuma ser o JID real)
    // 3. remoteJid (Padrão, mas as vezes é LID)
    
    let rawRemoteJid = key.remoteJidAlt || ''

    // Se não tiver Alt, tenta o Sender (se for válido e não for o próprio bot)
    if (!rawRemoteJid && sender && sender.includes('@s.whatsapp.net') && !key.fromMe) {
        rawRemoteJid = sender
    }

    // Última tentativa: o remoteJid padrão
    if (!rawRemoteJid) {
        rawRemoteJid = key.remoteJid || data.remoteJid || ''
    }

    // Se depois de tudo isso ainda for LID, avisamos no log
    if (rawRemoteJid.includes('@lid')) {
        console.warn(`⚠️ ALERTA: Ainda estou com LID (${rawRemoteJid}). Tentando extrair número mesmo assim.`)
    }

    if (rawRemoteJid.includes('@g.us') || key.fromMe) {
        return NextResponse.json({ message: 'Ignored group/self' }, { status: 200 })
    }

    // Limpeza: 553399998888@s.whatsapp.net -> 99998888
    const phoneDigits = rawRemoteJid.replace(/\D/g, '')
    const searchPhone = phoneDigits.slice(-8)

    // Extrai texto
    let content = ''
    if (messageData.conversation) content = messageData.conversation
    else if (messageData.extendedTextMessage?.text) content = messageData.extendedTextMessage.text
    else if (messageData.pollUpdates?.[0]?.vote?.selectedOptions?.[0]?.name) {
        content = messageData.pollUpdates[0].vote.selectedOptions[0].name
    }

    if (!content) return NextResponse.json({ message: 'No content' }, { status: 200 })
    
    console.log(`📩 Processando: "${content}" de ...${searchPhone} (Origem: ${rawRemoteJid})`)

    const lowerContent = content.toLowerCase().trim()
    const isConfirmation = CONFIRMATION_KEYWORDS.some(w => lowerContent.includes(w))
    const isCancellation = CANCELLATION_KEYWORDS.some(w => lowerContent.includes(w))

    if (!isConfirmation && !isCancellation) {
        return NextResponse.json({ message: 'Unknown command' }, { status: 200 })
    }

    // 3. Banco de Dados
    const supabase = createAdminClient()

    // Busca pelo final do telefone (8 dígitos)
    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, organization_id')
        .ilike('phone', `%${searchPhone}%`)
        .limit(1)
        .single()

    if (!customer) {
        console.log(`❌ Cliente não encontrado (Final: ...${searchPhone}).`)
        return NextResponse.json({ message: 'Customer not found' }, { status: 200 })
    }

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
        console.log(`❌ Agendamento não encontrado para ${customer.name}.`)
        return NextResponse.json({ message: 'No appointment found' }, { status: 200 })
    }

    // --- CENÁRIO: CONFIRMAR ---
    if (isConfirmation) {
        await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id)
        console.log(`✅ Confirmado: ${customer.name}`)
        return NextResponse.json({ success: true }, { status: 200 })
    }

    // --- CENÁRIO: CANCELAR ---
    if (isCancellation) {
        await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id)
        console.log(`🚫 Cancelado: ${customer.name}`)

        // Busca Horários Livres
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

        const textMessage = `Poxa, que pena! 😕\n\nJá cancelei seu horário aqui.\n\nSe quiser remarcar para *amanhã (${format(tomorrow, 'dd/MM', { locale: ptBR })})*, tenho estes horários livres:\n\n${freeSlots.map(h => `▪️ ${h}`).join('\n')}\n\nResponda com o horário desejado ou me chame para ver outros dias!`

        const apiUrl = `${EVOLUTION_API_URL}/message/sendText/${instance}`
        
        await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: rawRemoteJid.replace('@s.whatsapp.net', '').replace(/@lid/g, ''),
                text: textMessage
            })
        })
        
        console.log("📤 Oferta enviada para:", apiUrl)
        return NextResponse.json({ success: true }, { status: 200 })
    }

  } catch (error) {
    console.error("❌ Erro:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}