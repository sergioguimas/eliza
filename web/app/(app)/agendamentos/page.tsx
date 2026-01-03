import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar-view"

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
    .single()

  if (!profile?.organization_id) {
    redirect('/configuracoes') 
  }

  const orgId = profile.organization_id

  // 3. Busca em paralelo
  const [customersRes, servicesRes, appointmentsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),

    supabase
      .from('services')
      .select('id, title, color')
      .eq('organization_id', orgId)
      .eq('is_active', true),

    supabase
      .from('appointments')
      .select(`
        id, 
        start_time, 
        end_time, 
        status, 
        customers(name), 
        services(title, color)
      `)
      .eq('organization_id', orgId)
  ])

  // Tratamento de segurança
  const customers = customersRes.data || []
  const services = servicesRes.data || []
  const appointments = appointmentsRes.data || []

  // Adaptação para o CalendarView não quebrar
  const mappedServices = services.map((s: any) => ({
    ...s,
    name: s.title 
  }))

  const mappedAppointments = appointments.map((a: any) => ({
    ...a,
    services: a.services ? { ...a.services, name: a.services.title } : null,
    customers: a.customers ? { ...a.customers, full_name: a.customers.name } : null
  }))

  const mappedCustomers = customers.map((c: any) => ({
    ...c,
    full_name: c.name
  }))

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Agenda Médica</h1>
        <p className="text-zinc-400 text-sm">Visualize e gerencie os atendimentos.</p>
      </div>

      <CalendarView 
        appointments={mappedAppointments} 
        customers={mappedCustomers} 
        services={mappedServices}
        organizations_id={orgId}
      />
    </div>
  )
}