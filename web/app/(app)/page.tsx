import { createClient } from "@/utils/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Users, Calendar, TrendingUp } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  // Definir intervalo do dia de hoje para filtrar agendamentos
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Buscas paralelas para não travar o carregamento (Promise.all)
  const [
    { count: servicesCount },
    { count: customersCount },
    { count: appointmentsTodayCount },
    { data: nextAppointment }
  ] = await Promise.all([
    // 1. Total de Procedimentos
    supabase.from('services').select('*', { count: 'exact', head: true }),
    
    // 2. Total de Pacientes
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    
    // 3. Agendamentos Hoje
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString()),

    // 4. Próximo Agendamento (Bonus!)
    supabase
      .from('appointments')
      .select('*, customers(name), services(title)')
      .gte('start_time', new Date().toISOString()) // A partir de agora
      .order('start_time', { ascending: true })
      .limit(1)
      .single()
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Visão Geral</h1>
        <p className="text-zinc-400">Resumo da atividade da sua clínica.</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card de Procedimentos */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Procedimentos Ativos
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicesCount || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              Serviços cadastrados no catálogo
            </p>
          </CardContent>
        </Card>

        {/* Card de Pacientes */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Base de Pacientes
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersCount || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              Total de clientes registrados
            </p>
          </CardContent>
        </Card>

        {/* Card de Agenda Hoje */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Agenda Hoje
            </CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointmentsTodayCount || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              Consultas marcadas para hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Destaque: Próximo Paciente */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-zinc-950 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle>Próximo Atendimento</CardTitle>
          </CardHeader>
          <CardContent className="pl-6">
            {nextAppointment ? (
              <div className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-800 text-blue-200 font-bold text-lg">
                  {/* @ts-ignore */}
                  {nextAppointment.customers?.name?.substring(0,2).toUpperCase()}
                </div>
                <div>
                  {/* @ts-ignore */}
                  <p className="text-lg font-medium leading-none">{nextAppointment.customers?.name}</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {/* @ts-ignore */}
                    {nextAppointment.services?.title} • {new Date(nextAppointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="ml-auto font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded text-sm border border-emerald-500/20">
                  Confirmado
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                <Calendar className="h-8 w-8 mb-2 opacity-50" />
                <p>Nenhum agendamento futuro encontrado.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-blue-600 border-blue-500 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Dica do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-100">
              Mantenha o cadastro dos seus pacientes atualizado (email e telefone) para reduzir faltas nas consultas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}