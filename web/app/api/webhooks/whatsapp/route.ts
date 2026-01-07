import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { addDays, format, parseISO, setHours, setMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Palavras-chave
const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'vou', 'comparecer', 'ok', '👍', 'diga']
const CANCELLATION_KEYWORDS = ['não', 'nao', 'cancelar', 'cancela', 'não vou', 'nao vou', 'remarcar', 'outro dia', 'imprevisto']

// Horários de funcionamento para sugestão (Pode virar config no futuro)
const WORKING_HOURS = [9, 10, 11, 14, 15, 16, 17]

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { event, data, sender, server_url, apikey, instance } = payload
    
    // --- 1. Validação Básica ---
    if (event !== 'messages.upsert' && event !== 'messages.update') {
      return NextResponse.json({ message: 'Ignored event' }, { status: 200 })
    }

    // --- 2. Extrair Telefone e Conteúdo ---
    const messageData = data.message || data
    const key = data.key || messageData.key || {}
    const rawRemoteJid = key.remoteJidAlt || key.remoteJid || data.remoteJid || ''
    
    if (rawRemoteJid.includes('@g.us') || key.fromMe) {
        return NextResponse.json({ message: 'Ignored group/self' }, { status: 200 })
    }

    const phoneDigits = rawRemoteJid.replace(/\D/g, '')
    const searchPhone = phoneDigits.slice(-8)

    // Extrai o texto (seja digitado ou clique em botão)
    let content = ''
    if (messageData.conversation) content = messageData.conversation
    else if (messageData.extendedTextMessage?.text) content = messageData.extendedTextMessage.text
    else if (messageData.pollUpdates?.[0]?.vote?.selectedOptions?.[0]?.name) {
        content = messageData.pollUpdates[0].vote.selectedOptions[0].name
    }

    if (!content) return NextResponse.json({ message: 'No content' }, { status: 200 })
    
    console.log(`📩 Processando: "${content}" de ...${searchPhone}`)

    const lowerContent = content.toLowerCase().trim()
    const isConfirmation = CONFIRMATION_KEYWORDS.some(w => lowerContent.includes(w))
    const isCancellation = CANCELLATION_KEYWORDS.some(w => lowerContent.includes(w))

    if (!isConfirmation && !isCancellation) {
        return NextResponse.json({ message: 'Unknown command' }, { status: 200 })
    }

    // --- 3. Buscar Cliente e Agendamento ---
    const supabase = createAdminClient()

    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, organization_id')
        .ilike('phone', `%${searchPhone}%`)
        .limit(1)
        .single()

    if (!customer) return NextResponse.json({ message: 'Customer not found' }, { status: 200 })

    // Janela de busca: últimas 24h até futuro infinito
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

    if (!appointment) return NextResponse.json({ message: 'No appointment found' }, { status: 200 })

    // --- CENÁRIO A: CONFIRMAÇÃO ---
    if (isConfirmation) {
        await supabase
            .from('appointments')
            .update({ status: 'confirmed' })
            .eq('id', appointment.id)

        console.log(`✅ Agendamento Confirmado: ${customer.name}`)
        return NextResponse.json({ success: true, action: 'confirmed' }, { status: 200 })
    }

    // --- CENÁRIO B: CANCELAMENTO E REAGENDAMENTO ---
    if (isCancellation) {
        // 1. Cancela no Banco
        await supabase
            .from('appointments')
            .update({ status: 'canceled' })
            .eq('id', appointment.id)
        
        console.log(`🚫 Agendamento Cancelado: ${customer.name}`)

        // 2. Busca Próximos Horários Livres (Simplificado: Amanhã)
        const tomorrow = addDays(new Date(), 1)
        const startOfDay = new Date(tomorrow.setHours(0,0,0,0)).toISOString()
        const endOfDay = new Date(tomorrow.setHours(23,59,59,999)).toISOString()

        // Pega todos os agendamentos de amanhã para checar colisão
        const { data: busySlots } = await supabase
            .from('appointments')
            .select('start_time')
            .eq('organization_id', appointment.organization_id)
            .neq('status', 'canceled')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)

        const busyTimes = new Set(busySlots?.map(a => new Date(a.start_time).getHours()))

        // Filtra horários livres
        const freeSlots = WORKING_HOURS
            .filter(hour => !busyTimes.has(hour))
            .slice(0, 3) // Pega só os 3 primeiros
            .map(hour => `${hour}:00`)

        // 3. Monta a Mensagem de Resposta
        const textMessage = `Poxa, que pena! 😕\n\nJá cancelei seu horário aqui.\n\nSe quiser remarcar para *amanhã (${format(tomorrow, 'dd/MM', { locale: ptBR })})*, tenho estes horários livres:\n\n${freeSlots.map(h => `▪️ ${h}`).join('\n')}\n\nResponda com o horário desejado ou me chame para ver outros dias!`

        // 4. Envia via Evolution API
        if (server_url && apikey) {
            await fetch(`${server_url}/message/sendText/${instance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apikey
                },
                body: JSON.stringify({
                    number: rawRemoteJid.replace('@s.whatsapp.net', ''), // Remove sufixo se tiver
                    text: textMessage
                })
            })
            console.log("📤 Oferta de reagendamento enviada.")
        }

        return NextResponse.json({ success: true, action: 'canceled_and_offered' }, { status: 200 })
    }

  } catch (error) {
    console.error("❌ Erro no webhook:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}