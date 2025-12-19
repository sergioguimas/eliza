import { createClient } from "@/utils/supabase/server"
import { CalendarView } from "@/components/calendar-view"
import { redirect } from "next/navigation"

export default async function AppointmentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // 1. Buscar Pacientes (Para o Modal de Criação)
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name')

  // 2. Buscar Serviços (Para o Modal de Criação)
  const { data: services } = await supabase
    .from('services')
    .select('id, title, price')
    .eq('is_active', true)
    .order('title')

  // 3. Buscar Agendamentos (Do mês atual e arredores)
  // Dica: Num sistema grande, filtraríamos por data aqui. 
  // No MVP, vamos pegar os futuros e recentes para simplificar a query.
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id,
      start_time,
      end_time,
      status,
      customers (name),
      services (title, color)
    `)
    // @ts-ignore
    .order('start_time', { ascending: true })

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-100">Agenda Médica</h1>
        <p className="text-zinc-400">Visualize e gerencie seus atendimentos.</p>
      </div>

      {/* O componente visual cuida de tudo agora 👇 */}
      <CalendarView 
        // @ts-ignore
        appointments={appointments || []} 
        // @ts-ignore
        customers={customers || []} 
        // @ts-ignore
        services={services || []} 
      />
    </div>
  )
}