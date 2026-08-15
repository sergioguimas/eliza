import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  CalendarDays,
  Building2,
  ShieldCheck,
  Clock,
  MessageCircleWarningIcon,
  Coins,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"
import { CategoryIcon } from "@/components/shared/category-icon"
import { AppointmentContextMenu } from "@/components/appointments/appointment-context-menu"
import {
  cn,
  formatBRL,
  formatSaoPauloTime,
  getFinancialMonthRange,
} from "@/lib/utils"
import { AppointmentCardActions } from "@/components/appointments/appointment-card-actions"
import { RealtimeAppointments } from "@/components/layout/realtime-appointments"
import { Database } from "@/utils/database.types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PendingRequestsList } from "@/components/dashboard/pending-request-list"

type ProfileWithOrg = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations: Pick<
    Database["public"]["Tables"]["organizations"]["Row"],
    "niche" | "name"
  > | null
}

function getBrazilDateStr(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
}

function getBrazilDayBounds(dateStr: string) {
  return {
    start: `${dateStr}T00:00:00-03:00`,
    end: `${dateStr}T23:59:59-03:00`,
  }
}

// "seg., 17/08" — usado nos cards do bloco "Próximos dias", que pode
// misturar compromissos de dias diferentes. Curto de propósito: cabe ao
// lado do horário sem quebrar o layout do card.
function formatShortDayLabel(dateStr: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateStr}T12:00:00-03:00`))
}

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(niche, name)")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) redirect("/configuracoes")

  const typedProfile = profile as ProfileWithOrg
  const orgId = typedProfile.organization_id
    if (!orgId) redirect("/configuracoes")
  const niche = typedProfile.organizations?.niche || "generico"

  const dict = getDictionary(niche)

  const orgName = typedProfile.organizations?.name || "Minha organização"
  const userName = typedProfile.full_name
    ? typedProfile.full_name.split(" ")[0]
    : "Usuário"

  const clientePlural =
    dict.entities?.cliente_plural
  const agendamentoSingular = dict.entities?.agendamento || "Agendamento"
  const agendamentoPlural = dict.entities?.agendamento_plural || "Agendamentos"

  const dashboardTitle = dict.messages?.dashboard_title || "Visão geral"
  const dashboardDescription =
    dict.messages?.dashboard_description ||
    "Aqui está o resumo operacional de hoje."

  const todayDateStr = getBrazilDateStr(new Date())
  const { start: todayStart } = getBrazilDayBounds(todayDateStr)
  const { start: monthStart, end: monthEnd } = getFinancialMonthRange()

  // Janela de 14 dias, não só hoje: "Próximos compromissos" existe pra
  // mostrar a agenda viva, e travar em "hoje" faz a lista ficar vazia sem
  // motivo real num fim de semana ou início de semana devagar, mesmo com
  // compromissos marcados pra daqui a dois dias. O card de KPI "Hoje" acima
  // continua literal — aqui é só a lista.
  const windowEndDate = new Date()
  windowEndDate.setDate(windowEndDate.getDate() + 14)
  const { end: windowEnd } = getBrazilDayBounds(getBrazilDateStr(windowEndDate))

  const [resServices, resCustomers, resUpcoming, resAll, resMonthRevenue] = await Promise.all([
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_active", true),

    supabase
      .from("customers")
      .select("*")
      .eq("organization_id", orgId)
      .eq("active", true),

    supabase
      .from("appointments")
      .select(`
        id,
        start_time,
        status,
        customer_id,
        service_id,
        professional_id,
        payment_status,
        payment_method,
        customers(name),
        services(title, color)
      `)
      .eq("organization_id", orgId)
      .gte("start_time", todayStart)
      .lte("start_time", windowEnd)
      .neq("status", "canceled")
      .order("start_time", { ascending: true })
      .limit(50),

    supabase
      .from("appointments")
      .select("status")
      .eq("organization_id", orgId)
      .neq("status", "canceled")
      .neq("status", "cancelled"),

    // Mesmos filtros do `recebido` de `getFinancialSummary`, para o card bater
    // com o "Recebido (Caixa)" da /dashboard/financas que ele abre.
    supabase
      .from("appointments")
      .select("price")
      .eq("organization_id", orgId)
      .gte("start_time", monthStart)
      .lte("start_time", monthEnd)
      .eq("payment_status", "paid")
      .neq("status", "canceled"),
  ])

  const { data: pendingRequests } = await supabase
    .from("appointments")
    .select(`
      id,
      start_time,
      customers (name),
      services (title),
      professionals (name)
    `)
    .eq("status", "pending")
    .eq("organization_id", orgId)
    .order("start_time", { ascending: true })

  const upcomingAppointments = (resUpcoming.data || []).map((app: any) => ({
    ...app,
    customers: { name: app.customers?.name || "Sem nome" },
    services: {
      title: app.services?.title || dict.entities?.servico || "Serviço",
      color: app.services?.color,
    },
  }))

  // Card de KPI "Hoje" e o bloco "Hoje" da lista usam o mesmo recorte
  // literal — conta certo é zero num dia sem nada marcado.
  const todayAppointments = upcomingAppointments.filter(
    (app) => getBrazilDateStr(new Date(app.start_time)) === todayDateStr
  )

  // Bloco "Próximos dias": tudo na janela que não é hoje, capado pra não
  // virar uma lista longa demais numa agenda cheia — quem quer ver tudo tem
  // a agenda completa a um clique.
  const futureAppointments = upcomingAppointments
    .filter((app) => getBrazilDateStr(new Date(app.start_time)) !== todayDateStr)
    .slice(0, 5)

  const totalCustomers = resCustomers.data?.length || 0
  const totalPendingRequests = pendingRequests?.length || 0

  const monthRevenue = (resMonthRevenue.data || []).reduce(
    (total, appointment) => total + Number(appointment.price || 0),
    0
  )

  return (
    <div className="space-y-8">
      <RealtimeAppointments />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {dashboardTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            Olá, <span className="text-foreground font-medium">{userName}</span>.{" "}
            {dashboardDescription}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          {/*
            Atalho para a ação principal do produto. `?new=true` já é tratado
            pelo calendário, que abre o formulário direto — evita o desvio de
            entrar na agenda e procurar por onde começar.
          */}
          <Button asChild size="sm">
            <Link href="/agendamentos?new=true">
              <Plus className="mr-2 h-4 w-4" />
              {dict.actions?.create_agendamento || `Novo ${agendamentoSingular.toLowerCase()}`}
            </Link>
          </Button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none">
                Organização
              </span>
              <span className="text-sm font-semibold text-foreground">
                {orgName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none">
                Cargo
              </span>
              <span className="text-sm font-semibold text-foreground capitalize">
                {typedProfile.role === "owner" ? "Proprietário" : "Colaborador"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        data-tour="dashboard-resumo"
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Dialog>
          <DialogTrigger asChild>
            <div className="block group cursor-pointer h-full">
              <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all h-full">
                <CardContent className="p-4 flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                      Solicitações
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                      {totalPendingRequests}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Aguardando aprovação
                    </p>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                    <MessageCircleWarningIcon className="h-4 w-4 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogTrigger>

          <DialogContent className="max-w-md border-zinc-800 bg-zinc-950">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Solicitações pendentes
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Analise os pedidos recebidos antes da aprovação final.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <PendingRequestsList initialRequests={pendingRequests || []} />
            </div>
          </DialogContent>
        </Dialog>

        <Link href="/agendamentos" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  {agendamentoPlural}
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {todayAppointments.length}
                </h2>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <CalendarDays className="h-4 w-4 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/clientes" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  {clientePlural}
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {totalCustomers}
                </h2>
              </div>
              <div className="p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <CategoryIcon name="clientes" className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/financas" className="block group">
          <Card className="bg-card border-border group-hover:bg-accent/20 group-hover:border-primary/50 transition-all cursor-pointer h-full">
            <CardContent className="p-4 flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  Financeiro
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {formatBRL(monthRevenue)}
                </h2>
                <p className="text-xs text-muted-foreground">Recebido no mês</p>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Coins className="h-4 w-4 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="space-y-4" data-tour="dashboard-proximos">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            {agendamentoPlural} de hoje
          </h3>
          <span className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full border border-border">
            {todayAppointments.length} hoje
          </span>
        </div>

        <div className="grid gap-3">
          {todayAppointments.length > 0 ? (
            todayAppointments.map((app: any) => (
              <AppointmentRow key={app.id} app={app} />
            ))
          ) : (
            <div className="text-muted-foreground italic p-12 border border-dashed border-border rounded-xl text-center bg-card/50">
              Nenhum {agendamentoSingular.toLowerCase()} para hoje.
            </div>
          )}
        </div>
      </div>

      {/*
        Só aparece quando há algo além de hoje — sem isso, um dia comum (a
        maioria) mostraria um bloco "Próximos dias" permanentemente vazio,
        ocupando espaço por nada.
      */}
      {futureAppointments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-500" />
              Próximos dias
            </h3>
            <span className="text-xs text-muted-foreground bg-card px-2 py-1 rounded-full border border-border">
              {futureAppointments.length}
            </span>
          </div>

          <div className="grid gap-3">
            {futureAppointments.map((app: any) => (
              <AppointmentRow key={app.id} app={app} showDayLabel />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AppointmentRow({
  app,
  showDayLabel = false,
}: {
  app: any
  showDayLabel?: boolean
}) {
  return (
    <AppointmentContextMenu appointment={app}>
      <Card
        className="bg-card border-border p-4 border-l-10 cursor-context-menu hover:bg-accent/50 transition-all group relative overflow-hidden"
        style={{ borderLeftColor: app.services?.color || "#3b82f6" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-xs text-primary group-hover:border-primary/50 transition-colors">
              {app.customers?.name?.substring(0, 2).toUpperCase()}
            </div>

            <div>
              <p className="font-bold text-sm text-foreground">
                {app.customers?.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{app.services?.title}</span>
                <span className="text-border">•</span>
                <span className="text-primary font-medium">
                  {showDayLabel &&
                    `${formatShortDayLabel(getBrazilDateStr(new Date(app.start_time)))} · `}
                  {formatSaoPauloTime(app.start_time)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider",
                app.status === "scheduled" &&
                  "bg-blue-500/10 text-blue-500 border-blue-500/20",
                app.status === "arrived" &&
                  "bg-amber-500/10 text-amber-500 border-amber-500/20",
                app.status === "confirmed" &&
                  "bg-green-500/10 text-green-500 border-green-500/20",
                app.status === "completed" &&
                  (app.payment_status === "paid"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-indigo-500/10 text-indigo-500 border-indigo-500/20")
              )}
            >
              {app.status === "scheduled" && "Agendado"}
              {app.status === "arrived" && "Na recepção"}
              {app.status === "confirmed" && "Confirmado"}
              {app.status === "completed" &&
                (app.payment_status === "paid"
                  ? `Finalizado (${app.payment_method || "Pago"})`
                  : "Finalizado (Pendente)")}
            </span>

            <div className="relative z-10">
              <AppointmentCardActions appointment={app} />
            </div>
          </div>
        </div>
      </Card>
    </AppointmentContextMenu>
  )
}