import { createClient } from "@/utils/supabase/server"
import { NextResponse } from "next/server"
import { format, addDays, subHours } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database } from "@/utils/database.types"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient<Database>()

  const nowUtc = new Date()
  const nowBrazil = subHours(nowUtc, 3) 
  
  const tomorrow = addDays(nowBrazil, 1)
  
  // Define o intervalo de busca (00:00 até 23:59 do dia seguinte no BRASIL)
  const startOfDay = new Date(tomorrow)
  startOfDay.setHours(0, 0, 0, 0)
  
  const endOfDay = new Date(tomorrow)
  endOfDay.setHours(23, 59, 59, 999)

  // Convertemos para ISO String para o Banco (que espera UTC, mas o intervalo está correto)
  const startIso = startOfDay.toISOString()
  const endIso = endOfDay.toISOString()

  console.log(`🤖 Cron Job - Buscando entre: ${startIso} e ${endIso}`)

  const { data: appointments, error } = await (supabase.from('appointments'))
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
        organization_settings ( msg_appointment_reminder )
      )
    `)
    .eq('status', 'scheduled')
    .gte('start_time', startIso)
    .lte('start_time', endIso)

  if (error) {
    console.error("Erro ao buscar agendamentos:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ 
        message: "Nenhum agendamento para lembrar amanhã.",
        debug_search_range: {
            from: startIso,
            to: endIso,
            server_time_utc: nowUtc.toISOString(),
            simulated_brazil_time: nowBrazil.toISOString()
        }
    })
  }

  let successCount = 0
  let failCount = 0

  for (const app of appointments) {
    if (!app.customers || !app.organizations) { failCount++; continue }

    const phone = app.customers.phone?.replace(/\D/g, "")
    const org = app.organizations
    
    if (!phone || !org?.slug) { failCount++; continue }

    const instanceName = org.slug
    const EVOLUTION_URL = org.evolution_api_url || process.env.NEXT_PUBLIC_EVOLUTION_API_URL
    const API_KEY = org.evolution_api_key || process.env.EVOLUTION_API_KEY
    
    const finalPhone = phone.startsWith("55") ? phone : `55${phone}`

    const rawSettings = org.organization_settings as any
    const settings = Array.isArray(rawSettings) ? rawSettings[0] : rawSettings
    
    let template = settings?.msg_appointment_reminder || "Olá {name}, lembrete do seu agendamento amanhã às {time}. Confirma?"
    
    const dateObjUtc = new Date(app.start_time)
    const dateBrazil = subHours(dateObjUtc, 3) 
    const timeStr = format(dateBrazil, "HH:mm", { locale: ptBR })
    
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
    failed: failCount,
    debug_search_range: {
        from: startIso,
        to: endIso
    }
  })
}