import { createClient } from "@/utils/supabase/server"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

// Palavras-chave aceitas (pode adicionar mais)
const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'ok', 'pode ser', 'confirmado']
const CANCELLATION_KEYWORDS = ['cancelar', 'não', 'nao', 'desmarcar']

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // 1. Verifica se é um evento de MENSAGEM
    const eventType = body.event || body.type
    if (eventType !== 'messages.upsert') {
        return NextResponse.json({ status: 'ignored' })
    }

    const messageData = body.data
    const key = messageData.key
    const messageContent = messageData.message

    // 2. Ignora mensagens enviadas por NÓS (do sistema) ou de Grupos
    if (key.fromMe || key.remoteJid.includes('@g.us')) {
        return NextResponse.json({ status: 'ignored_self_or_group' })
    }

    // 3. Extrai o texto da mensagem (Baileys tem várias formas de mandar texto)
    let text = ''
    if (messageContent.conversation) {
        text = messageContent.conversation
    } else if (messageContent.extendedTextMessage?.text) {
        text = messageContent.extendedTextMessage.text
    } else {
        return NextResponse.json({ status: 'no_text' }) // É áudio, foto, etc.
    }

    text = text.trim().toLowerCase()
    
    // 4. Lógica de Confirmação
    if (CONFIRMATION_KEYWORDS.some(k => text.includes(k))) {
        await handleConfirmation(key.remoteJid)
        return NextResponse.json({ status: 'processed_confirmation' })
    }

    return NextResponse.json({ status: 'received' })

  } catch (error) {
    console.error("Erro no Webhook:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// --- FUNÇÃO AUXILIAR QUE ATUALIZA O BANCO ---
async function handleConfirmation(remoteJid: string) {
    const supabase = await createClient()

    // Limpa o número para buscar no banco (Remove @s.whatsapp.net e o 55 se necessário)
    // O banco geralmente salva como (11) 99999-9999 ou 5511999999999. Vamos tentar buscar pelos últimos 8 dígitos para garantir.
    const rawNumber = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    const searchNumber = rawNumber.slice(-8) // Pega os últimos 8 dígitos para ser flexível

    console.log(`🔍 [Webhook] Buscando agendamento para confirmar. Tel: ${rawNumber}`)

    // 1. Busca o cliente pelo telefone
    // Usamos .ilike com % para achar qualquer cliente que tenha esse final de número
    const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .ilike('phone', `%${searchNumber}%`)
        
    if (!customers || customers.length === 0) {
        console.log("❌ [Webhook] Cliente não encontrado.")
        return
    }

    const customerIds = customers.map(c => c.id)

    // 2. Busca o PRÓXIMO agendamento PENDENTE (status 'pending') desse cliente
    // Ignoramos os passados e pegamos o primeiro do futuro
    const now = new Date().toISOString()
    
    const { data: appointment, error } = await supabase
        .from('appointments')
        .select('id, status, start_time')
        .in('customer_id', customerIds)
        .eq('status', 'pending') // Só confirma se estiver pendente (não mexe nos cancelados/já confirmados)
        .gt('start_time', now)   // Só agendamentos futuros
        .order('start_time', { ascending: true }) // O mais próximo
        .limit(1)
        .single()

    if (error || !appointment) {
        console.log("⚠️ [Webhook] Nenhum agendamento pendente futuro encontrado.")
        return
    }

    // 3. ATUALIZA PARA CONFIRMADO
    const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointment.id)

    if (!updateError) {
        console.log(`✅ [Webhook] Agendamento ${appointment.id} confirmado via WhatsApp!`)
    }
}