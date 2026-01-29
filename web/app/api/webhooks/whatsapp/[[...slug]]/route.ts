import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"

// 🟢 Palavras de Confirmação
const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'ok', 'pode ser', 'confirmado', 'tá bom', 'ta bom', 'estarei', 'vou sim', 'claro']

// 🔴 Palavras de Cancelamento
const CANCELLATION_KEYWORDS = ['não', 'nao', 'cancelar', 'desmarcar', 'não vou', 'nao vou', 'infelizmente', 'impossivel', 'impossível', 'outro dia', 'reagendar']

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const eventType = body.event || body.type

    if (eventType !== 'messages.upsert') {
        return NextResponse.json({ status: 'ignored_not_message' })
    }

    const messageData = body.data
    const key = messageData.key
    const messageContent = messageData.message

    if (key.fromMe) {
        return NextResponse.json({ status: 'ignored_from_me' })
    }

    let text = ''
    if (messageContent.conversation) {
        text = messageContent.conversation
    } else if (messageContent.extendedTextMessage?.text) {
        text = messageContent.extendedTextMessage.text
    } else {
        return NextResponse.json({ status: 'no_text_content' }) 
    }
    text = text.trim().toLowerCase()

    console.log(`📩 [Webhook] Texto recebido: "${text}"`)

    if (CONFIRMATION_KEYWORDS.some(k => text.includes(k))) {
        await handleStatusChange(body, 'confirmed')
        return NextResponse.json({ status: 'processed_confirmation' })
    } 
    else if (CANCELLATION_KEYWORDS.some(k => text.includes(k))) {
        await handleStatusChange(body, 'canceled')
        return NextResponse.json({ status: 'processed_cancellation' })
    }

    return NextResponse.json({ status: 'ignored_no_keyword' })

  } catch (error: any) {
    console.error('🔥 Erro no Webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleStatusChange(body: any, newStatus: 'confirmed' | 'canceled') {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Extração do Número (Lógica Anti-LID)
    let rawNumber = body.data?.key?.remoteJid
    const participant = body.data?.key?.participant

    if (rawNumber && String(rawNumber).includes('@lid')) {
        if (participant && !String(participant).includes('@lid')) {
            rawNumber = participant
        } else {
            return 
        }
    }

    if (!rawNumber) return 

    const incomingClean = String(rawNumber).replace(/@.*/, '').replace(/\D/g, '')
    const last8 = incomingClean.slice(-8)
    const last4 = incomingClean.slice(-4) 

    // 2. Busca Cliente
    const { data: candidates } = await supabase
        .from('customers')
        .select('id, name, phone')
        .or(`phone.ilike.%${last8},phone.ilike.%${last4}`) 

    if (!candidates || candidates.length === 0) {
        console.log(`⚠️ [Webhook] Cliente não encontrado para o final ${last4}`)
        return
    }

    const foundCustomer = candidates.find(c => {
        if (!c.phone) return false
        return c.phone.replace(/\D/g, '').endsWith(last8)
    })

    if (!foundCustomer) return

    const now = new Date().toISOString()
    
    // 3. Busca Agendamento
    const { data: appointment } = await supabase
        .from('appointments')
        .select('id, status, start_time, organization_id') 
        .eq('customer_id', foundCustomer.id)
        .in('status', ['pending', 'scheduled', 'confirmed'])
        .gt('start_time', now)
        .order('start_time', { ascending: true })
        .limit(1)
        .single()

    if (!appointment) {
        console.log(`⚠️ [Webhook] Nenhum agendamento futuro encontrado para cliente ${foundCustomer.id}`)
        return
    }

    // 4. Atualiza Status
    const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id)
    
    if (updateError) {
        console.error(`🔥 [Webhook] Erro ao atualizar agendamento:`, updateError)
        return
    }
    
    console.log(`🎉 [Webhook] Agendamento ${appointment.id} atualizado para: ${newStatus.toUpperCase()}`)

    // 5. RESPOSTA AUTOMÁTICA    
    const { data: settings } = await supabase
        .from('organization_settings') 
        .select('msg_appointment_canceled')
        .eq('organization_id', appointment.organization_id)
        .single()

    let replyMessage = ""

    if (newStatus === 'confirmed') {
        // Se você criar uma coluna 'msg_appointment_confirmed' no futuro, mude aqui:
        // const customMsg = settings?.msg_appointment_confirmed
        const customMsg = null 
        
        if (customMsg) {
            replyMessage = customMsg
        } else {
            replyMessage = "✅ *Confirmado!* Já deixei tudo certo na agenda. Te aguardamos! Até lá."
        }
    } 
    else if (newStatus === 'canceled') {
        const customMsg = settings?.msg_appointment_canceled 
        
        if (customMsg && customMsg.trim().length > 0) {
            replyMessage = customMsg
        } else {
            replyMessage = "👌 *Entendido.* O agendamento foi cancelado. Quando quiser remarcar, é só chamar!"
        }
    }

    // ✨ MÁGICA: Substitui {name} pelo nome real do cliente
    if (replyMessage && foundCustomer.name) {
        // Pega apenas o primeiro nome para ficar mais pessoal
        const firstName = foundCustomer.name.split(' ')[0]
        replyMessage = replyMessage.replace(/{name}/g, firstName)
    }

    if (replyMessage) {
        await sendWhatsAppMessage({
            phone: foundCustomer.phone || incomingClean,
            message: replyMessage,
            organizationId: appointment.organization_id
        })
    }
}