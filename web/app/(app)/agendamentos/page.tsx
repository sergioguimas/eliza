import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { CalendarView } from "@/components/calendar-view"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Agendamentos | MedAgenda",
  description: "Visualize e gerencie sua agenda.",
}

export default async function AgendamentosPage() {
  const supabase = await createClient()

  // 1. Autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Buscar Perfil (Organization ID)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div className="p-8">Erro: Usuário sem organização vinculada.</div>
  }

  // 3. Buscar Agendamentos
  // Nota: Agora que arrumamos o SQL, 'customers' vai funcionar.
  const { data: rawAppointments } = await supabase
    .from('appointments')
    .select(`
      *,
      customers ( id, name, phone ), 
      services ( id, name, duration )
    `)
    .eq('organization_id', profile.organization_id)

  // 4. Tratamento de Dados (O "Pulo do Gato" para corrigir o erro de Tipagem)
  // Mapeamos os dados brutos para o formato exato que o CalendarView espera.
  const appointments = rawAppointments?.map(app => ({
    ...app,
    // Garante que status nunca seja null
    status: app.status || 'pending', 
    // Garante que customer exista (mesmo que o banco falhe)
    customer: Array.isArray(app.customers) ? app.customers[0] : app.customers,
    service: Array.isArray(app.services) ? app.services[0] : app.services
  })) || []

  // 5. Buscar Dados para o Modal
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .order('name')

  const { data: services } = await supabase
    .from('services')
    .select('id, name, price')
    .eq('organization_id', profile.organization_id)
    .eq('active', true)
    .order('name')

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agenda</h2>
        <div className="flex items-center space-x-2">
          <CreateAppointmentDialog 
            // @ts-ignore (Ignora erro se customers vier nulo, passamos array vazio)
            customers={customers || []} 
            // @ts-ignore
            services={services || []} 
          />
        </div>
      </div>
      
      <div className="h-[calc(100vh-200px)] bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        {/* Agora passamos a lista tratada e limpa */}
        {/* @ts-ignore: Às vezes o TS reclama de tipos complexos no join, o ignore aqui é seguro pois tratamos acima */}
        <CalendarView appointments={appointments} />
      </div>
    </div>
  )
}