import { createClient } from "@supabase/supabase-js" // 👈 Mudança importante aqui
import { NextResponse } from "next/server"

const CONFIRMATION_KEYWORDS = ['sim', 'confirmar', 'confirmo', 'ok', 'pode ser', 'confirmado', 'tá bom', 'ta bom']

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

    if (CONFIRMATION_KEYWORDS.some(k => text.includes(k))) {
        await handleConfirmation(body)
        return NextResponse.json({ status: 'processed_confirmation' })
    }

    return NextResponse.json({ status: 'received_no_action' })

  } catch (error) {
    console.error("🔥 Erro no Webhook:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function handleConfirmation(body: any) {
    // 👇 CRIA UM CLIENTE COM PODERES DE ADMIN (Bypassa RLS)
    // Isso garante que o Webhook consiga ler a tabela customers mesmo sem usuario logado
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Tenta pegar o Alt
    let rawNumber = body.data?.key?.remoteJidAlt
    if (!rawNumber) rawNumber = body.data?.key?.remoteJid
    if (!rawNumber) rawNumber = body.data?.key?.participant

    if (!rawNumber) {
        console.log("❌ [Webhook] Erro: Nenhum número identificado.")
        return 
    }

    const incomingClean = String(rawNumber).replace(/@.*/, '').replace(/\D/g, '')
    
    // Pega os últimos 8 e 4 dígitos
    const last8 = incomingClean.slice(-8)
    const last4 = incomingClean.slice(-4) 

    console.log(`🔍 [Webhook] Buscando dono do número final ...${last8} (Modo Admin)`)

    // --- BUSCA AMPLA (BROAD SEARCH) ---
    const { data: candidates, error } = await supabase
        .from('customers')
        .select('id, phone, name')
        .ilike('phone', `%${last4}`)
    
    if (error) {
        console.error("❌ [Webhook] Erro no banco:", error.message)
        return
    }
        
    if (!candidates || candidates.length === 0) {
        console.log(`❌ [Webhook] Ninguém encontrado com final ...${last4}`)
        return
    }

    // Refinamento no JavaScript
    const foundCustomer = candidates.find(c => {
        if (!c.phone) return false
        const dbPhoneClean = c.phone.replace(/\D/g, '')
        return dbPhoneClean.endsWith(last8)
    })

    if (!foundCustomer) {
        console.log(`❌ [Webhook] Candidatos encontrados (${candidates.length}), mas nenhum bateu os 8 dígitos.`)
        return
    }

    console.log(`✅ [Webhook] Cliente identificado: ${foundCustomer.name}`)

    const now = new Date().toISOString()
    
    // Busca Agendamento
    const { data: appointment } = await supabase
        .from('appointments')
        .select('id, status, start_time')
        .eq('customer_id', foundCustomer.id)
        .eq('status', 'pending')
        .gt('start_time', now)
        .order('start_time', { ascending: true })
        .limit(1)
        .single()

    if (!appointment) {
        console.log("⚠️ [Webhook] Cliente sem agendamento pendente futuro.")
        return
    }

    // Confirma
    const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointment.id)

    if (!updateError) {
        console.log(`🎉 [Webhook] SUCESSO TOTAL! Agendamento ${appointment.id} confirmado para ${foundCustomer.name}.`)
    } else {
        console.log("❌ [Webhook] Erro ao atualizar agendamento:", updateError)
    }
}