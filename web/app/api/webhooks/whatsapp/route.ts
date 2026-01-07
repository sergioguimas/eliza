import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // 1. Pega o corpo bruto da requisição
    const payload = await request.json()
    
    // 2. IMPRIME TUDO NO LOG (O Segredo está aqui) 🕵️‍♂️
    console.log("🔍 [WEBHOOK DEBUG] Evento Recebido:", payload.event)
    console.log("📦 [PAYLOAD COMPLETO]:", JSON.stringify(payload, null, 2))

    // Retorna 200 OK para a Evolution não ficar tentando reenviar
    return NextResponse.json({ received: true }, { status: 200 })

  } catch (error) {
    console.error("❌ Erro no Webhook:", error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}