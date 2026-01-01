// web/app/(app)/agendamentos/page.tsx
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { CalendarView } from "@/components/calendar-view" // Vamos criar este componente

export default async function AgendamentosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organizations_id) redirect('/configuracoes')

  // Busca dados para o Modal e para o Calendário
  const [customers, services, appointments] = await Promise.all([
    supabase.from('customers').select('id, full_name').eq('organizations_id', profile.organizations_id).eq('active', true),
    supabase.from('services').select('id, name, duration, color').eq('organizations_id', profile.organizations_id).eq('active', true),
    supabase.from('appointments').select('*, customers(full_name), services(name, color)').eq('organizations_id', profile.organizations_id)
  ])

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Agenda Médica</h1>
          <p className="text-zinc-400 text-sm">Visualize e gerencie seus atendimentos por mês ou dia.</p>
        </div>
        
        <CreateAppointmentDialog 
          customers={customers.data || []} 
          services={services.data || []} 
          organizations_id={profile.organizations_id} 
        />
      </div>

      {/* Componente que gerencia a troca entre Mês e Dia */}
      <CalendarView appointments={appointments.data || []} />
    </div>
  )
}