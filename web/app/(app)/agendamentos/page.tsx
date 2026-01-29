import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar-view"
import { RealtimeAppointments } from "@/components/realtime-appointments"
import { getDictionary } from "@/lib/get-dictionary"

export const metadata: Metadata = {
  title: "Agenda | Eliza",
}

export default async function AgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  
  const params = await searchParams

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, organizations(niche)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/configuracoes') 
  }

  const orgId = profile.organization_id
  const niche = profile?.organizations?.niche || 'generico'
  const dict = getDictionary(niche)

  // 3. Busca em paralelo
  const [customersRes, servicesRes, staffRes, appointmentsRes, settingsRes] = await Promise.all([
    // Clientes
    supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true) 
      .order('name'),

    // Serviços
    supabase
      .from('services')
      .select('id, title, color') 
      .eq('organization_id', orgId)
      .eq('active', true),
      
    // Staff (Profissionais)
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organization_id', orgId)
      .in('role', ['owner', 'professional']), 

    // Agendamentos
    supabase
      .from('appointments')
      .select(`
        id, 
        customer_id,
        start_time, 
        end_time, 
        status, 
        professional_id,
        customers ( name ), 
        services ( title, color ),
        profiles ( full_name )
      `)
      .eq('organization_id', orgId)
      .neq('status', 'canceled'), // Esconde cancelados

      // Configurações (Horários)
    supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', orgId)
      .single()
  ])

  // Tratamento de arrays vazios
  const customers = customersRes.data || []
  const services = servicesRes.data || []
  const staff = staffRes.data || []
  const appointments = appointmentsRes.data || []
  const settings = settingsRes.data || {}

  return (
    <div className="space-y-8">
      <RealtimeAppointments />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda de {dict.label_servicos}</h1>
        <p className="text-muted-foreground text-sm">Visualize e gerencie os atendimentos da clínica.</p>
      </div>

      <CalendarView 
        appointments={appointments as any}
        customers={customers} 
        services={services}
        staff={staff}
        organization_id={orgId}
        currentUser={profile}
        settings={settings}
      />
    </div>
  )
}