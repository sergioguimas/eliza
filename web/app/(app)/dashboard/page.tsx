import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
import { AppointmentContextMenu } from "@/components/appointment-context-menu"
import { cn } from "@/lib/utils"
import { AppointmentCardActions } from "@/components/appointment-card-actions"
import { RealtimeAppointments } from '@/components/realtime-appointments'

// --- 1. FUNÇÃO DE DATA (BRASIL) ---
function getBrazilDayRange() {
  const brazilDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const start = `${brazilDateStr}T00:00:00-03:00`
  const end = `${brazilDateStr}T23:59:59-03:00`
  return { start, end }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // 2. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // 3. Busca Perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organization_id (name)
    `)
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id) redirect('/configuracoes')

  const orgId = profile.organization_id
  const orgName = profile.organizations?.name || "Minha Clínica"

  // 4. Definição do período de "Hoje"
  const { start: todayStart, end: todayEnd } = getBrazilDayRange()

  // 5. Busca de dados
  const [resServices, resCustomers, resToday, resAll] = await Promise.all([
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
    supabase.from('customers').select('*').eq('organization_id', orgId).eq('active', true),
    
    // --- QUERY DE AGENDA HOJE ---
    supabase
      .from('appointments')
      .select(`
        id, start_time, status, 
        customers(name), 
        services(title, color)
      `)
      .eq('organization_id', orgId)
      .gte('start_time', todayStart) // Começo do dia BR
      .lte('start_time', todayEnd)   // Fim do dia BR
      .neq('status', 'canceled')     // Tchau cancelados (1 L)
      .neq('status', 'cancelled')    // Tchau cancelados (2 L)
      .order('start_time', { ascending: true }),
      
    // --- QUERY DE TODOS OS AGENDAMENTOS (Para estatística) ---
    supabase.from('appointments')
      .select('status')
      .eq('organization_id', orgId)
      .neq('status', 'canceled')
      .neq('status', 'cancelled')
  ]) as any

  // 6. Preparação dos dados
  const customersList = (resCustomers.data || []).map((c: any) => ({
    id: c.id,
    name: c.name || "Sem Nome"
  }))

  const servicesList = (resServices.data || []).map((s: any) => ({
    id: s.id,
    title: s.title || "Serviço",
    color: s.color
  }))

  const todayAppointments = (resToday.data || []).map((app: any) => ({
    ...app,
    customers: { name: app.customers?.name || "Sem Nome" },
    services: { title: app.services?.title || "Procedimento", color: app.services?.color }
  }))

  // Cálculos
  const totalServices = resServices.count || 0
  const totalCustomers = resCustomers.data?.length || 0
  const totalAllApps = resAll.data?.length || 0 
  const completedApps = resAll.data?.filter((a: any) => a.status === 'completed').length || 0
  const presenceRate = totalAllApps > 0 ? Math.round((completedApps / totalAllApps) * 100) : 0

  // 7. Pega o primeiro nome do perfil ou fallback seguro
  const doctorName = profile?.full_name ? profile.full_name.split(' ')[0] : "Doutor"

  return (
    <div className="space-y-8">
      <RealtimeAppointments />
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">
            Olá, <span className="text-foreground font-medium">{doctorName}</span>. 
            Aqui está o resumo operacional de hoje.
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none">Empresa</span>
              <span className="text-sm font-semibold text-foreground">{orgName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none">Cargo</span>
              <span className="text-sm font-semibold text-foreground capitalize">{profile?.role === 'owner' ? 'Proprietário' : 'Colaborador'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Cards Clicáveis */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        
        <Link href="/servicos" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Procedimentos</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{totalServices}</h2>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Stethoscope className="h-4 w-4 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clientes" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Pacientes</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{totalCustomers}</h2>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <Users className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agendamentos" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Agenda Hoje</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{todayAppointments.length}</h2>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <CalendarDays className="h-4 w-4 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agendamentos" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">Presença</p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{presenceRate}%</h2>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Lista de Atendimentos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" /> Próximos Atendimentos
          </h3>
          <span className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full border border-border">
            {todayAppointments.length} hoje
          </span>
        </div>

        <div className="grid gap-3">
          {todayAppointments.length > 0 ? (
            todayAppointments.map((app: any) => (
              <AppointmentContextMenu 
                key={app.id}
                appointment={app} 
                customers={customersList}
                services={servicesList}
              >
                <Card 
                  className="bg-card border-border p-4 border-l-10 cursor-context-menu hover:bg-accent/50 transition-all group relative overflow-hidden" 
                  style={{ borderLeftColor: app.services?.color || '#3b82f6' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-primary group-hover:border-primary/50 transition-colors">
                        {app.customers?.name?.substring(0, 2).toUpperCase()}
                      </div>
                      
                      <div>
                        <p className="font-bold text-sm text-foreground">{app.customers?.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{app.services?.title}</span>
                          <span className="text-border">•</span>
                          <span className="text-primary font-medium">
                            {new Date(app.start_time).toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              timeZone: 'UTC' 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* LADO DIREITO: Status + Botão de Ação Visual */}
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider",
                        app.status === 'scheduled' && "bg-blue-500/10 text-blue-500 border-blue-500/20",
                        app.status === 'arrived' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                        app.status === 'completed' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                        app.status === 'confirmed' && "bg-green-500/10 text-green-500 border-green-500/20"
                      )}>
                        {app.status === 'scheduled' ? 'Agendado' : 
                         app.status === 'arrived' ? 'Na Recepção' : 
                         app.status === 'completed' ? 'Finalizado' : 
                         app.status === 'confirmed' ? 'Confirmado' : app.status}
                      </span>

                      {/* Ícone de 3 pontos para indicar que é clicável */}
                      <div className="relative z-10">
                        <AppointmentCardActions appointment={app} />
                      </div>
                    </div>
                  </div>
                </Card>
              </AppointmentContextMenu>
            ))
          ) : (
            <div className="text-muted-foreground italic p-12 border border-dashed border-border rounded-xl text-center bg-card/50">
              Nenhum agendamento para hoje.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}