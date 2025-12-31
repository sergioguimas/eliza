import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Users, 
  Stethoscope, 
  CalendarDays, 
  Building2, 
  ShieldCheck,
  CheckCircle2 
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Verifica quem é o usuário
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // 2. Busca os dados do Perfil e da Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (
        name,
        slug
      )
    `)
    .eq('id', user.id)
    .single() as any

  // Para garantir que o TypeScript entenda a estrutura interna:
  const org = profile?.organizations

  // 3. Busca Indicadores (Contagens)
  const [servicesCount, patientsCount, appointmentsToday, allAppointments] = await Promise.all([
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('organizations_id', profile.organizations_id),
    
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('organizations_id', profile.organizations_id),

    supabase
      .from('appointments')
      .select(`
        *,
        customers:customer_id (full_name),
        services:service_id (name)
      `) // Explicita que customer_id é a ponte para a tabela customers
      .eq('organizations_id', profile.organizations_id)
      .gte('start_time', new Date().toISOString().split('T')[0])
      .order('start_time', { ascending: true }),

      // Query de hoje (para o card de Próximo Atendimento)
      supabase.from('appointments').select('...'),

      // Nova query para estatísticas de presença (últimos 30 dias por exemplo)
      supabase
      .from('appointments')
      .select('status')
      .eq('organizations_id', profile.organizations_id)
  ]) as any

const total = allAppointments.data?.length || 0
const presence = allAppointments.data?.filter((a: any) => a.status === 'concluded').length || 0
const presenceRate = total > 0 ? Math.round((presence / total) * 100) : 100

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
    {/* Cabeçalho Otimizado: Nome + Empresa + Cargo em uma linha */}
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, <span className="text-zinc-100 font-medium">{profile?.full_name || user.email}</span>
        </p>
      </div>
      
      <div className="flex gap-3">
        {/* Info Compacta de Empresa */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <Building2 className="h-4 w-4 text-zinc-500" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-zinc-500 font-bold leading-none">Empresa</span>
            <span className="text-sm font-semibold text-zinc-200">{profile?.organizations?.name}</span>
          </div>
        </div>

        {/* Info Compacta de Cargo */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <ShieldCheck className="h-4 w-4 text-zinc-500" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-zinc-500 font-bold leading-none">Cargo</span>
            <span className="text-sm font-semibold text-zinc-200 capitalize">{profile?.role || 'Admin'}</span>
          </div>
        </div>
      </div>
    </div>

    {/* Grid de Indicadores Otimizada - 4 cards na mesma linha */}
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card: Procedimentos */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Procedimentos</p>
              <h2 className="text-2xl font-bold tracking-tight">{servicesCount.count || 0}</h2>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Stethoscope className="h-4 w-4 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Pacientes */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Pacientes</p>
              <h2 className="text-2xl font-bold tracking-tight">{patientsCount.count || 0}</h2>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Users className="h-4 w-4 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Agenda Hoje */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Agenda Hoje</p>
              <h2 className="text-2xl font-bold tracking-tight">{appointmentsToday.data?.length || 0}</h2>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <CalendarDays className="h-4 w-4 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Taxa de Presença */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Presença</p>
              <h2 className="text-2xl font-bold tracking-tight">{presenceRate}%</h2>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

      {/* Seção Próximo Atendimento */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Próximo Atendimento</h3>
        {appointmentsToday.data?.[0] ? (
          <Card className="bg-zinc-900/50 border-zinc-800 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                  {appointmentsToday.data[0].customers?.full_name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg">{appointmentsToday.data[0].customers?.full_name}</p>
                  <p className="text-sm text-zinc-400">
                    {appointmentsToday.data[0].services?.name} • {new Date(appointmentsToday.data[0].start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                Confirmado
              </span>
            </div>
          </Card>
        ) : (
          <div className="text-zinc-500 italic p-8 border border-dashed border-zinc-800 rounded-lg text-center">
            Nenhuma consulta agendada para o restante do dia.
          </div>
        )}
      </div>

    </div>
  )
}