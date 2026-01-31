import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sendWhatsAppMessage } from "@/app/actions/send-whatsapp"
import { startOfDay } from "date-fns/startOfDay"

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

    const messageTimestamp = body.data?.messageTimestamp; 
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (key.fromMe) {
        return NextResponse.json({ status: 'ignored_from_me' })
    }

    if (messageTimestamp && (nowSeconds - messageTimestamp > 600)) {
        return NextResponse.json({ status: 'ignored_old_message' });
    }

    // 1. Coleta o conteúdo bruto da mensagem
    let text = ''
    const messageContent = messageData.message

    if (messageContent?.conversation) {
        // Texto simples
        text = messageContent.conversation
    } else if (messageContent?.extendedTextMessage?.text) {
        // Texto com links ou formatação (negrito, itálico, etc.)
        text = messageContent.extendedTextMessage.text
    } else if (messageContent?.buttonsResponseMessage?.selectedButtonId) {
        // Caso você use botões no futuro, captura o ID do botão
        text = messageContent.buttonsResponseMessage.selectedButtonId
    } else {
        // Se não houver texto tratável, ignora
        return NextResponse.json({ status: 'no_text_content' }) 
    }

    // 2. Limpeza e Normalização
    // Trim remove espaços no início/fim e toLowerCase padroniza para a busca
    text = text.trim().toLowerCase()

    console.log(`📩 [Webhook] Texto recebido e normalizado: "${text}"`)

    console.log(`📩 [Webhook] Texto recebido: "${text}"`)

    if (CONFIRMATION_KEYWORDS.some(k => text.includes(k))) {
        await handleStatusChange(body, 'confirmed', text)
        return NextResponse.json({ status: 'processed_confirmation' })
    } 
    else if (CANCELLATION_KEYWORDS.some(k => text.includes(k))) {
        await handleStatusChange(body, 'canceled', text)
        return NextResponse.json({ status: 'processed_cancellation' })
    }

    return NextResponse.json({ status: 'ignored_no_keyword' })

  } catch (error: any) {
    console.error('🔥 Erro no Webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleStatusChange(body: any, newStatus: 'confirmed' | 'canceled', text: string) {
    console.log(`🔔 [Webhook] Iniciando processo para status: ${newStatus.toUpperCase()}`)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Extração hierárquica (do mais preciso para o menos preciso)
    let rawNumber = 
        body.data?.key?.remoteJidAlt || // Opção 1: O ID alternativo real
        body.sender ||                  // Opção 2: O remetente identificado pela API
        body.data?.key?.participant ||  // Opção 3: O participante (comum em grupos)
        body.data?.key?.remoteJid;      // Opção 4: O Jid padrão (pode ser @lid)

    // 2. Limpeza total de caracteres não numéricos
    const incomingClean = String(rawNumber).replace(/@.*/, '').replace(/\D/g, '');
    
    // 3. Verificação de segurança: Ignora IDs de LID que não foram convertidos
    if (incomingClean.length < 8) {
        console.log("⚠️ [Webhook] Identificador numérico inválido ou muito curto:", incomingClean);
        return;
    }

    const last8 = incomingClean.slice(-8);
    const last4 = incomingClean.slice(-4);

    console.log(`✅ [Webhook] Remetente identificado com sucesso: ${incomingClean}`);

    // 2. Busca Cliente
    console.log(`🔍 Buscando cliente com final ${last4}`);
    const { data: candidates } = await supabase
        .from('customers')
        .select('id, name, phone')
        .or(`phone.ilike.%${last8},phone.ilike.%${last4}`) 
        console.log(`🔍 Candidatos encontrados: ${candidates?.length || 0}`);

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
    console.log(`📅 Buscando agendamento para cliente ID: ${foundCustomer.id} após ${now}`);
    const { data: appointment } = await supabase
        .from('appointments')
        .select('id, status, start_time, organization_id') 
        .eq('customer_id', foundCustomer.id)
        .in('status', ['pending', 'scheduled', 'confirmed'])
        .gte('start_time', startOfDay(new Date()).toISOString())
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

    await supabase.from('appointment_logs').insert({
        appointment_id: appointment.id,
        customer_id: foundCustomer.id,
        action: newStatus,
        source: 'whatsapp_webhook',
        raw_message: text,
        push_name: body.data?.pushName || 'Desconhecido'
    });
    
    console.log(`🎉 [Webhook] Agendamento ${appointment.id} atualizado para: ${newStatus.toUpperCase()}`)

    // 5. RESPOSTA AUTOMÁTICA    
    const { data: settings } = await supabase
        .from('organization_settings') 
        .select('msg_appointment_canceled')
        .eq('organization_id', appointment.organization_id)
        .single()

    let replyMessage = ""

    if (newStatus === 'confirmed') {
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