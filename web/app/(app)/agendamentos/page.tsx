import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar-view"

export default async function AgendamentosPage() {
  const supabase = await createClient()

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o perfil para obter o ID da organização
  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organizations_id) {
    redirect('/configuracoes') // Ou mostre uma mensagem de erro amigável
  }

// 3. Busca em paralelo com tipagem flexível para evitar erros de compilação
  const [customersRes, servicesRes, appointmentsRes]: any = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name') // Verifique no banco se é full_name ou name
      .eq('organizations_id', profile.organizations_id)
      .eq('active', true)
      .order('full_name'),

    supabase
      .from('services')
      .select('id, name, color') // Verifique no banco se é name ou title
      .eq('organizations_id', profile.organizations_id)
      .eq('active', true),

    supabase
      .from('appointments')
      .select(`
        id, 
        start_time, 
        end_time, 
        status, 
        customers(full_name), 
        services(name, color)
      `)
      .eq('organizations_id', profile.organizations_id)
  ])

  // Tratamento de segurança para os dados
  const customers = customersRes.data || []
  const services = servicesRes.data || []
  const appointments = appointmentsRes.data || []

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Agenda Médica</h1>
        <p className="text-zinc-400 text-sm">Visualize e gerencie os atendimentos.</p>
      </div>

      <CalendarView 
        appointments={appointments} 
        customers={customers} 
        services={services}
        organizations_id={profile.organizations_id}
      />
    </div>
  )
}