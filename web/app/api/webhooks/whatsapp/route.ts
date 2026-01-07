import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    
    // --- MODO DETETIVE: IMPRIME TUDO ---
    console.log("🔍 [WEBHOOK DEBUG] Evento Recebido:", payload.event)
    console.log("📦 [PAYLOAD COMPLETO]:", JSON.stringify(payload, null, 2))
    
    return NextResponse.json({ message: 'Debug received' }, { status: 200 })

  } catch (error) {
    console.error("❌ Erro no Debug:", error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
}