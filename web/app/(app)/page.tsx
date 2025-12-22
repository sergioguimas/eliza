import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, DollarSign, Activity, Clock } from "lucide-react"
import { format, isToday, parseISO } from "date-fns"
import { AppointmentContextMenu } from "@/components/appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.tenant_id) return <div>Erro: Perfil sem clínica vinculada.</div>

  const tenantId = profile.tenant_id

  // 1. Estatísticas Rápidas
  const { count: customersCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // 2. Agendamentos de Hoje e Futuros Próximos
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
    .eq('tenant_id', tenantId)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(5)

  const todayAppointments = appointments?.filter(app => isToday(parseISO(app.start_time))) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">
            Olá, {profile.full_name?.split(' ')[0] || 'Doutor(a)'}
          </h1>
          <p className="text-zinc-400">Aqui está o resumo do seu dia.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Agenda Hoje
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{todayAppointments.length}</div>
            <p className="text-xs text-zinc-500">
              pacientes agendados
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Pacientes Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">{customersCount || 0}</div>
            <p className="text-xs text-zinc-500">
              total cadastrado
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Faturamento (Mês)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">R$ --</div>
            <p className="text-xs text-zinc-500">
              Em breve
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Taxa de Presença
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-100">--%</div>
            <p className="text-xs text-zinc-500">
              Em breve
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Próximos Atendimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!appointments?.length ? (
                <p className="text-zinc-500 text-sm">Nenhum agendamento futuro encontrado.</p>
              ) : (
                appointments.map((apt) => {
                  const status = apt.status || 'scheduled'
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG['scheduled']
                  // @ts-ignore
                  const serviceColor = apt.services?.color || '#3b82f6'
                  
                  return (
                    <AppointmentContextMenu key={apt.id} appointment={apt}>
                      <div 
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-all hover:bg-zinc-800/50 cursor-pointer group",
                          "bg-zinc-950/50 border-zinc-800"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className={cn(
                              "h-10 w-1 rounded-full",
                              status === 'scheduled' ? `bg-[${serviceColor}]` : config.color.replace('text-', 'bg-').replace('/10', '')
                            )}
                            style={status === 'scheduled' ? { backgroundColor: serviceColor } : {}}
                          />
                          
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none text-zinc-200">
                              {/* @ts-ignore */}
                              {apt.customers?.name}
                            </p>
                            <div className="flex items-center text-xs text-zinc-500 gap-2">
                               {/* @ts-ignore */}
                               <span className="text-zinc-400">{apt.services?.title}</span>
                               {status !== 'scheduled' && (
                                 <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1", config.color)}>
                                    <config.icon className="h-3 w-3" />
                                    {config.label}
                                 </span>
                               )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                             <p className="text-sm font-medium text-zinc-100">
                               {format(parseISO(apt.start_time), "HH:mm")}
                             </p>
                             <p className="text-xs text-zinc-500">
                               {isToday(parseISO(apt.start_time)) 
                                 ? 'Hoje' 
                                 : format(parseISO(apt.start_time), "dd/MM")}
                             </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600">
                             <Clock className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </AppointmentContextMenu>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <Link href="/agendamentos" className="block">
                <Button variant="outline" className="w-full justify-start text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-zinc-700 h-12">
                   <Calendar className="mr-2 h-4 w-4" /> Ver Agenda Completa
                </Button>
             </Link>
             <Link href="/clientes" className="block">
                <Button variant="outline" className="w-full justify-start text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border-zinc-700 h-12">
                   <Users className="mr-2 h-4 w-4" /> Gerenciar Pacientes
                </Button>
             </Link>
             
             <div className="mt-8 p-4 rounded bg-zinc-950 border border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-300 mb-2">Dica do Sistema</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">
                   Clique nos agendamentos ao lado para mudar rapidamente o status para "Na Recepção" ou "Atendido".
                </p>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}