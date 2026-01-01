import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Users, 
  Stethoscope, 
  CalendarDays, 
  Building2, 
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // 2. Busca Perfil e Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (name, slug)
    `)
    .eq('id', user.id)
    .single() as any

  if (!profile?.organizations_id) redirect('/configuracoes')

  // 3. Definição do período de "Hoje" para o filtro UTC
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  // 4. Busca de dados unificada com nomes únicos
  const [resServices, resPatients, resToday, resAll] = await Promise.all([
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('organizations_id', profile.organizations_id)
      .eq('active', true),
    
    supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('organizations_id', profile.organizations_id)
      .eq('active', true),

    supabase
      .from('appointments')
      .select(`
        id, 
        start_time, 
        status, 
        customers(full_name), 
        services(name, color)
      `)
      .eq('organizations_id', profile.organizations_id)
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true }),

    supabase
      .from('appointments')
      .select('status')
      .eq('organizations_id', profile.organizations_id)
  ]) as any

  // Cálculos de indicadores
  const totalApps = resAll.data?.length || 0
  const completedApps = resAll.data?.filter((a: any) => a.status === 'completed').length || 0
  const presenceRate = totalApps > 0 ? Math.round((completedApps / totalApps) * 100) : 0
  const nextApp = resToday.data?.[0]

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      {/* Cabeçalho Otimizado: Nome + Empresa + Cargo */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, <span className="text-zinc-100 font-medium">{profile?.full_name || user.email}</span>
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <Building2 className="h-4 w-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-zinc-500 font-bold leading-none">Empresa</span>
              <span className="text-sm font-semibold text-zinc-200">{profile?.organizations?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <ShieldCheck className="h-4 w-4 text-zinc-500" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-zinc-500 font-bold leading-none">Cargo</span>
              <span className="text-sm font-semibold text-zinc-200 capitalize">{profile?.role || 'Admin'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de 4 indicadores na mesma linha */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
          <CardContent className="p-4 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Procedimentos</p>
              <h2 className="text-2xl font-bold tracking-tight">{resServices.count || 0}</h2>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg"><Stethoscope className="h-4 w-4 text-blue-500" /></div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
          <CardContent className="p-4 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Pacientes</p>
              <h2 className="text-2xl font-bold tracking-tight">{resPatients.count || 0}</h2>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg"><Users className="h-4 w-4 text-green-500" /></div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
          <CardContent className="p-4 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Agenda Hoje</p>
              <h2 className="text-2xl font-bold tracking-tight">{resToday.data?.length || 0}</h2>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg"><CalendarDays className="h-4 w-4 text-purple-500" /></div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900 transition-colors">
          <CardContent className="p-4 flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Presença</p>
              <h2 className="text-2xl font-bold tracking-tight">{presenceRate}%</h2>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Próximo Atendimento em Destaque */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" /> Próximo Atendimento
        </h3>
        {nextApp ? (
          <Card className="bg-zinc-900/50 border-zinc-800 p-6 border-l-4" style={{ borderLeftColor: nextApp.services?.color || '#3b82f6' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-blue-500">
                  {nextApp.customers?.full_name?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-lg text-zinc-100">{nextApp.customers?.full_name}</p>
                  <p className="text-sm text-zinc-400">
                    {nextApp.services?.name} • <span className="text-blue-400 font-medium">
                      {new Date(nextApp.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                    </span>
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold border border-blue-500/20 uppercase tracking-widest">
                Agendado
              </span>
            </div>
          </Card>
        ) : (
          <div className="text-zinc-500 italic p-12 border border-dashed border-zinc-800 rounded-xl text-center">
            Nenhuma consulta agendada para o restante do dia.
          </div>
        )}
      </div>
    </div>
  )
}