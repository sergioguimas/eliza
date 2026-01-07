import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// --- CONFIGURAÇÕES ---
// Substitua se o seu Ngrok mudou
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

    // --- NOVA LÓGICA DE EXTRAÇÃO DE NÚMERO ---
    // Coleta todos os IDs possíveis
    const candidates = [
        key.remoteJid,
        key.remoteJidAlt,
        key.participant,
        data.remoteJid
    ].filter(Boolean) // Remove vazios

    // Procura o PRIMEIRO que seja um número real (@s.whatsapp.net)
    let targetJid = candidates.find(jid => jid.includes('@s.whatsapp.net'))
    
    // Se não achar nenhum @s.whatsapp.net, pega o primeiro que tiver (fallback)
    if (!targetJid) {
        targetJid = candidates[0] || ''
    }

    // Se for grupo ou mensagem enviada por mim, ignora
    if (targetJid.includes('@g.us') || key.fromMe) {
        return NextResponse.json({ message: 'Ignored group/self' }, { status: 200 })
    }

    // Limpeza: Pega os últimos 8 dígitos para garantir match no banco
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
    
    console.log(`📩 Processando: "${content}" de final ...${searchPhone} (JID: ${targetJid})`)

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
        console.log(`❌ Cliente final ...${searchPhone} não encontrado.`)
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
        console.log(`❌ ${customer.name} não tem agendamento pendente.`)
        return NextResponse.json({ message: 'No appointment found' }, { status: 200 })
    }

    // --- AÇÃO: CONFIRMAR ---
    if (isConfirmation) {
        await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment.id)
        console.log(`✅ Confirmado: ${customer.name}`)
        return NextResponse.json({ success: true }, { status: 200 })
    }

    // --- AÇÃO: CANCELAR E OFERECER HORÁRIOS ---
    if (isCancellation) {
        // 1. Cancela
        await supabase.from('appointments').update({ status: 'canceled' }).eq('id', appointment.id)
        console.log(`🚫 Cancelado: ${customer.name}`)

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

        // 3. Responde com Oferta
        const textMessage = `Poxa, que pena! 😕\n\nJá cancelei seu horário aqui.\n\nSe quiser remarcar para *amanhã (${format(tomorrow, 'dd/MM', { locale: ptBR })})*, tenho estes horários livres:\n\n${freeSlots.map(h => `▪️ ${h}`).join('\n')}\n\nResponda com o horário desejado ou me chame para ver outros dias!`

        const apiUrl = `${EVOLUTION_API_URL}/message/sendText/${instance}`
        
        await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: targetJid.replace('@s.whatsapp.net', ''), // Usa o JID limpo que achamos no início
                text: textMessage
            })
        })
        
        console.log("📤 Oferta enviada para:", apiUrl)
        return NextResponse.json({ success: true }, { status: 200 })
    }

  } catch (error) {
    console.error("❌ Erro Interno:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}