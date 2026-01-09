import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const tomorrow = addDays(new Date(), 1)
  const startOfDay = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString()
  const endOfDay = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString()

  console.log(`🤖 Iniciando Cron Job para: ${startOfDay.split('T')[0]}`)

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      status,
      customers ( name, phone ),
      services ( title ),
      organizations ( 
        slug, 
        evolution_api_url, 
        evolution_api_key,
        organization_settings ( whatsapp_message_reminder )
      )
    `)
    .eq('status', 'scheduled')
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)

  if (error) {
    console.error("Erro ao buscar agendamentos:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ message: "Nenhum agendamento para lembrar amanhã." })
  }

  let successCount = 0
  let failCount = 0

  for (const app of appointments) {
    // Se não tiver cliente ou organização, pula para o próximo
    if (!app.customers || !app.organizations) {
        failCount++
        continue
    }

    const phone = app.customers.phone?.replace(/\D/g, "")
    const org = app.organizations
    
    if (!phone || !org?.slug) {
        failCount++
        continue
    }

    const instanceName = org.slug
    const EVOLUTION_URL = org.evolution_api_url || process.env.NEXT_PUBLIC_EVOLUTION_API_URL
    const API_KEY = org.evolution_api_key || process.env.EVOLUTION_API_KEY
    
    const finalPhone = phone.startsWith("55") ? phone : `55${phone}`

    // Tratamento flexível das configurações
    const rawSettings = org.organization_settings as any
    const settings = Array.isArray(rawSettings) ? rawSettings[0] : rawSettings
    
    let template = settings?.whatsapp_message_reminder || "Olá {name}, lembrete do seu agendamento amanhã às {time}. Confirma?"
    
    const dateObj = new Date(app.start_time)
    const timeStr = format(dateObj, "HH:mm", { locale: ptBR })
    
    // Uso seguro do nome
    const firstName = app.customers.name ? app.customers.name.split(' ')[0] : 'Cliente'

    const message = template
      .replace(/{name}/g, firstName)
      .replace(/{time}/g, timeStr)
      .replace(/{service}/g, app.services?.title || 'Consulta')

    try {
      await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY as string },
        body: JSON.stringify({
          number: finalPhone,
          text: message
        })
      })
      successCount++
      await new Promise(r => setTimeout(r, 200)) 
    } catch (err) {
      console.error(`Falha ao enviar para ${finalPhone}:`, err)
      failCount++
    }
  }

  return NextResponse.json({
    success: true,
    processed: appointments.length,
    sent: successCount,
    failed: failCount
  })
}