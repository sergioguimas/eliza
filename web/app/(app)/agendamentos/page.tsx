import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { CalendarView } from "@/components/calendar-view"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Agendamentos | Eliza",
  description: "Visualize e gerencie sua agenda.",
}

export default async function AgendamentosPage() {
  const supabase = await createClient()

  // 1. Autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Buscar Perfil (Usando organizations_id no plural)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organizations_id) {
    return <div className="p-8 text-zinc-400 font-medium">Erro: Usuário sem organização vinculada.</div>
  }

  // 3. Busca Agendamentos com mapeamento de colunas explícito
  const { data: rawAppointments } = await supabase
    .from('appointments')
    .select(`
      *,
      customers:customer_id ( id, full_name, phone ), 
      services:service_id ( id, name, duration )
    `)
    .eq('organizations_id', profile.organizations_id)

  // Refinamos os dados para satisfazer o TypeScript e o componente
  const appointments = (rawAppointments || []).map(app => {
    const customerData = Array.isArray(app.customers) ? app.customers[0] : app.customers;
    const serviceData = Array.isArray(app.services) ? app.services[0] : app.services;

    return {
      ...app,
      // Garante que o status nunca seja null para evitar o erro de tipagem
      status: app.status || 'scheduled', 
      customer: customerData,
      service: serviceData,
    };
  }) as any;

  // 4. Buscar Clientes e Serviços para o Modal (Normalizando para o Dialog)
  const { data: rawCustomers } = await supabase
    .from('customers')
    .select('id, full_name') 
    .eq('organizations_id', profile.organizations_id)
    .order('full_name');

  const { data: rawServices } = await supabase
    .from('services')
    .select('id, name, price')
    .eq('organizations_id', profile.organizations_id)
    .eq('active', true)
    .order('name');

  // Mapeia full_name -> name para o componente não reclamar
  const customersForModal = (rawCustomers as any[])?.map(c => ({
    id: c.id,
    name: c.full_name
  })) || [];

  const servicesForModal = (rawServices as any[])?.map(s => ({
    id: s.id,
    name: s.name,
    price: s.price
  })) || [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 bg-black min-h-screen">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Agenda</h2>
        <div className="flex items-center space-x-2">
          <CreateAppointmentDialog 
            customers={customersForModal} 
            services={servicesForModal}
            organizations_id={profile.organizations_id}
          />
        </div>
      </div>
      
      <div className="h-[calc(100vh-200px)] bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
         <CalendarView 
            appointments={appointments} 
            customers={customersForModal} 
            services={servicesForModal} 
         />
      </div>
    </div>
  )
}