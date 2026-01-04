import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar-view"

export const metadata: Metadata = {
  title: "Agenda | Eliza",
}

export default async function AgendamentosPage() {
  const supabase = await createClient()

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id) {
    redirect('/configuracoes') 
  }

  const orgId = profile.organization_id

  // 3. Busca em paralelo (Otimizado e Sem Gambiarra de Mapeamento)
  const [customersRes, servicesRes, staffRes, appointmentsRes] = await Promise.all([
    // Clientes
    supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true) 
      .order('name'),

    // Serviços (Agora buscamos 'title' e 'color' nativos)
    supabase
      .from('services')
      .select('id, title, color') 
      .eq('organization_id', orgId)
      .eq('is_active', true),
      
    // Staff (Médicos/Profissionais)
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('organization_id', orgId),

    // Agendamentos (Join correto)
    supabase
      .from('appointments')
      .select(`
        id, 
        start_time, 
        end_time, 
        status, 
        customers ( name ), 
        services ( title, color )
      `)
      .eq('organization_id', orgId)
      .neq('status', 'canceled') // Esconde cancelados
  ])

  // Tratamento de arrays vazios
  const customers = customersRes.data || []
  const services = servicesRes.data || []
  const staff = staffRes.data || []
  const appointments = appointmentsRes.data || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda Médica</h1>
        <p className="text-muted-foreground text-sm">Visualize e gerencie os atendimentos.</p>
      </div>

      <CalendarView 
        appointments={appointments as any} 
        customers={customers as any} 
        services={services as any}
        staff={staff as any}
        organization_id={orgId}
      />
    </div>
  )
}