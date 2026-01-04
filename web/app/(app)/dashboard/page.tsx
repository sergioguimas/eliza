import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Activity, DollarSign } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id) redirect('/configuracoes')

  // Buscas básicas para popular os cards (Exemplo simplificado)
  const orgId = profile.organization_id

  // Executa queries em paralelo para performance
  const [appointmentsRes, customersRes] = await Promise.all([
    supabase.from('appointments').select('id, status, price').eq('organization_id', orgId),
    supabase.from('customers').select('id').eq('organization_id', orgId)
  ])

  const appointments = appointmentsRes.data || []
  const customersCount = customersRes.data?.length || 0
  
  // Cálculos rápidos
  const totalRevenue = appointments.reduce((acc, curr) => acc + (curr.price || 0), 0)
  const confirmed = appointments.filter((a: any) => a.status === 'confirmed').length
  const pending = appointments.filter((a: any) => a.status === 'pending' || a.status === 'scheduled').length

  return (
    // CORREÇÃO: Removido bg-black e min-h-screen. Layout limpo.
    <div className="space-y-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: Faturamento */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              +20.1% em relação ao mês passado
            </p>
          </CardContent>
        </Card>

        {/* CARD 2: Agendamentos */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agendamentos
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{appointments.length}</div>
            <p className="text-xs text-muted-foreground">
              {pending} pendentes de confirmação
            </p>
          </CardContent>
        </Card>

        {/* CARD 3: Atendidos */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmados
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{confirmed}</div>
            <p className="text-xs text-muted-foreground">
              Pacientes confirmados na agenda
            </p>
          </CardContent>
        </Card>

        {/* CARD 4: Pacientes Ativos */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Base de Pacientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{customersCount}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}