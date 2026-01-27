import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Phone, Mail, MapPin, Clock, User, FileText, Info, Pencil } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { UpdateCustomerDialog } from "@/components/update-customer-dialog"
import { CustomerRowActions } from "@/components/customer-row-actions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getServiceRecords } from "@/app/actions/service-records"
import { ServiceRecordList } from "@/components/service-record-list"
import { ServiceRecordForm } from "@/components/service-record-form"
import { Printer } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { unstable_noStore as noStore } from "next/cache"

export const dynamic = 'force-dynamic'

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  noStore()
  const { id } = await params
  const { tab } = await searchParams
  const supabase = await createClient()

  console.log(`[SERVER] Renderizando página do cliente ${id} em:`, new Date().toISOString())

  // 1. BUSCAR CLIENTE
  const { data: rawCustomer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (customerError || !rawCustomer) {
    notFound()
  }

  // VÁLVULA DE ESCAPE 1: Transforma o dado do banco em 'any'
  const customer = rawCustomer as any

  // 2. BUSCAR AGENDAMENTOS
  const { data: rawAppointments } = await supabase
    .from('appointments')
    .select(`
      *,
      services (title),
      profiles (full_name)
    `)
    .eq('customer_id', customer.id)
    .order('start_time', { ascending: false })
    .limit(20)

  const history = await getServiceRecords(id)

  // VÁLVULA DE ESCAPE 2: Garante que é um array, mesmo que venha null
  const appointments = (rawAppointments || []) as any[]

  // 3. BUSCAR HISTÓRICO
  const { data: rawRecords } = await supabase
    .from('service_records')
    .select(`
      *,
      profiles (full_name)
    `)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  // VÁLVULA DE ESCAPE 3
  const records = (rawRecords || []) as any[]

  // Helpers
  const isActive = customer.active !== false
  const getInitials = (name: string) => name ? name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() : 'CL'

  return (
    <div className="container max-w-5xl mx-auto space-y-8 p-6 md:py-8">
      
      {/* HEADER DO CLIENTE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b">
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border-4 border-white shadow-sm ring-1 ring-gray-200">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{customer.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-green-600 hover:bg-green-700" : ""}>
                {isActive ? "Cliente Ativo" : "Inativo"}
              </Badge>
              {customer.document && (
                <span className="text-sm font-medium text-muted-foreground px-2 py-0.5 bg-gray-100 rounded-md">
                  Doc: {customer.document}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
           <CustomerRowActions customer={customer} />
        </div>
      </div>

      {/* ÁREA PRINCIPAL COM 3 ABAS */}
      <Tabs defaultValue={tab || "details"} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl mb-6">
          <TabsTrigger value="appointments" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            Agendamentos
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            Histórico / Registros
          </TabsTrigger>
          <TabsTrigger value="info" className="rounded-lg text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
            Dados Cadastrais
          </TabsTrigger>
        </TabsList>
        
        {/* ABA 1: AGENDAMENTOS */}
        <TabsContent value="appointments" className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Linha do Tempo
            </h2>
          </div>
          
          {!appointments?.length ? (
            <Card className="border-dashed shadow-none bg-gray-50/50">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Nenhum agendamento registrado</p>
                <Button variant="link" className="mt-2 text-primary">Agendar agora</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {appointments.map((appt) => (
                <Card key={appt.id} className="group hover:shadow-md transition-shadow border-l-4 data-[status=canceled]:border-l-red-500 data-[status=confirmed]:border-l-green-500 data-[status=scheduled]:border-l-blue-500" data-status={appt.status}>
                   <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg">{appt.services?.title || "Serviço Removido"}</h4>
                          <Badge variant="outline" className="capitalize text-xs font-normal">
                            {appt.status === 'scheduled' ? 'Agendado' : 
                             appt.status === 'confirmed' ? 'Confirmado' : 
                             appt.status === 'canceled' ? 'Cancelado' : appt.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4" />
                            {format(new Date(appt.start_time), "dd 'de' MMM, yyyy", { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {format(new Date(appt.start_time), "HH:mm")}
                          </div>
                        </div>
                      </div>
                      
                      {appt.profiles && (
                        <div className="flex items-center gap-2 text-sm bg-black-50 px-3 py-1.5 rounded-full self-start md:self-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{appt.profiles.full_name}</span>
                        </div>
                      )}
                   </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: HISTÓRICO */}
        <TabsContent value="history" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Histórico e Evolução
                    </h2>
                    <p className="text-sm text-muted-foreground">Registros técnicos e observações.</p>
                </div>
                
                {/* Botão para Gerar Histórico Completo */}
                <Button variant="outline" size="sm" asChild>
                    <a href={`/print/history/${customer.id}`} target="_blank" rel="noopener noreferrer">
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir Histórico Completo
                    </a>
                </Button>
            </div>

            {/* Formulário de Novo Registro */}
            <div className="mb-8">
                <ServiceRecordForm customerId={customer.id} />
            </div>

            {/* Lista de Registros */}
            <ServiceRecordList 
                records={history} 
                customerId={customer.id} 
                customerPhone={customer.phone}
                organizationId={customer.organization_id}
            />
        </TabsContent>

        {/* ABA 3: DADOS CADASTRAIS */}
        <TabsContent value="info" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-4 h-4" /> Contato e Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Telefone / WhatsApp</label>
                  <div className="flex items-center gap-2 text-base">
                    <Phone className="h-4 w-4 text-green-600" />
                    {customer.phone}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">E-mail</label>
                  <div className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4 text-blue-600" />
                    {customer.email || <span className="text-muted-foreground italic">Não informado</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Endereço</label>
                  <div className="flex items-start gap-2 text-base">
                    <MapPin className="h-4 w-4 text-red-500 mt-1" />
                    <span className="flex-1">{customer.address || <span className="text-muted-foreground italic">Não informado</span>}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50/50 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-amber-900 dark:text-amber-500">
                  <Pencil className="w-4 h-4" /> Notas Internas
                </CardTitle>
                <CardDescription>Informações visíveis apenas para a equipe.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-lg border border-amber-100 dark:border-amber-900/50 min-h-[120px] shadow-sm">
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {customer.notes || "Nenhuma observação interna registrada para este cliente."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}

// --- Helpers Visuais ---

function getStatusColorHex(status: string | null) {
  if (!status) return '#94a3b8' 
  switch (status) {
    case 'confirmed': return '#22c55e'
    case 'canceled': return '#ef4444'
    case 'completed': return '#3b82f6'
    case 'arrived': return '#6366f1'
    default: return '#eab308' 
  }
}

function getStatusBadgeStyle(status: string | null) {
  if (!status) return 'bg-slate-100 text-slate-700'
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-700'
    case 'canceled': return 'bg-red-100 text-red-700'
    case 'completed': return 'bg-blue-100 text-blue-700'
    case 'arrived': return 'bg-indigo-100 text-indigo-700'
    default: return 'bg-yellow-100 text-yellow-700'
  }
}

function translateStatus(status: string | null) {
  if (!status) return 'Pendente'
  const map: Record<string, string> = {
    'scheduled': 'Agendado',
    'confirmed': 'Confirmado',
    'canceled': 'Cancelado',
    'completed': 'Concluído',
    'arrived': 'Em Atendimento'
  }
  return map[status] || status
}