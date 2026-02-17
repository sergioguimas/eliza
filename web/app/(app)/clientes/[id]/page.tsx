import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Phone, Mail, MapPin, Clock, User, FileText, Info, Pencil, MessageCircle } from "lucide-react"
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
import { unstable_noStore as noStore } from "next/cache"
import { Database } from "@/utils/database.types"
import { AppointmentContextMenu } from "@/components/appointment-context-menu"
import { ReturnModalWrapper } from "@/components/return-modal-wrapper"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ return_check?: string, show_return_modal?: string }>}) {
  noStore()
  const { id } = await params
  const { return_check } = await searchParams
  const { show_return_modal } = await searchParams;
  const supabase = await createClient<Database>()

  // 1. Busca dados do cliente, agendamentos e LOGS em paralelo
  const [customerRes, appointmentsRes, serviceRecords] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('appointments')
      .select(`
        *,
        services ( title, color ),
        professionals ( name ),
        appointment_logs (
          action,
          push_name,
          created_at,
          raw_message
        )
      `)
      .eq('customer_id', id)
      .order('start_time', { ascending: false }),
    getServiceRecords(id)
  ])

  if (!customerRes.data) notFound()

  const customer = customerRes.data
  const appointments = appointmentsRes.data || []

  const handleReturnConfirm = async (days: number | null) => {
    'use server'
    if (days === null) {
      redirect(`/agendamentos?customer_id=${id}&mode=new`)
    } else {
      const date = new Date();
      date.setDate(date.getDate() + days);
      const formattedDate = date.toISOString().split('T')[0];
      redirect(`/agendamentos?customer_id=${id}&date=${formattedDate}`)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header do Cliente */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/10">
            <AvatarFallback className="text-xl bg-primary/5 text-primary font-bold">
              {customer.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Badge variant="outline" className="font-normal capitalize">
                {customer.active ? 'Ativo' : 'Inativo'}
              </Badge>
              <span>•</span>
              <span className="text-sm">Cliente desde {format(new Date(customer.created_at), 'MMMM yyyy', { locale: ptBR })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UpdateCustomerDialog customer={customer} />
          <CustomerRowActions customer={customer} />
        </div>
      </div>

      <Tabs defaultValue={"records"} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl mb-6">
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="records">Prontuário</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        {/* ABA HISTÓRICO DE AGENDAMENTOS */}
        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-4">
            {appointments.length === 0 ? (
              <Card className="border-dashed flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nenhum agendamento encontrado para este cliente.</p>
              </Card>
            ) : (
              appointments.map((apt: any) => (
                <AppointmentContextMenu key={apt.id} appointment={apt}>
                <Card key={apt.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: getStatusColorHex(apt.status) }}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">
                            {format(new Date(apt.start_time), "dd 'de' MMMM", { locale: ptBR })}
                          </span>
                          <Badge className={getStatusBadgeStyle(apt.status)}>
                            {apt.status === 'confirmed' ? 'Confirmado' : 
                             apt.status === 'canceled' ? 'Cancelado' : 
                             apt.status === 'completed' && apt.payment_status === 'pending' ? 'Finalizado' : 
                             apt.status === 'completed' && apt.payment_status === 'paid' ? 'Pago' : ''}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(apt.start_time), 'HH:mm')} às {format(new Date(apt.end_time), 'HH:mm')}
                          </div>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {apt.services?.title || 'Serviço não informado'}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            Profissional: {apt.profiles?.full_name || 'Não atribuído'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BLOCO DE LOGS DO WHATSAPP (A MÁGICA ESTÁ AQUI) */}
                    {apt.appointment_logs && apt.appointment_logs.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-700/50">
                        {apt.appointment_logs.map((log: any, idx: number) => (
                          <div key={idx} className="flex gap-3">
                            <div className={cn(
                              "mt-1 p-1.5 rounded-full h-fit",
                              log.action === 'confirmed' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                            )}>
                              <MessageCircle className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wider">
                                  {log.action === 'confirmed' ? 'Confirmação Automática' : 'Cancelamento via Bot'}
                                </p>
                                <span className="text-[10px] text-muted-foreground italic">
                                  {format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                <strong>{log.push_name}</strong> respondeu: <span className="italic">"{log.raw_message}"</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                </AppointmentContextMenu>
              ))
            )}
          </div>
        </TabsContent>

        {/* ABA PRONTUÁRIOS */}
        <TabsContent value="records" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                <ServiceRecordForm customerId={customer.id} organizationId={customer.organization_id} defaultAppointmentId={return_check || null}/>
            </div>

            <ReturnModalWrapper 
              customerId={id}
              customerName={customer.name} 
            />

            {/* Lista de Registros */}
            <ServiceRecordList 
              records={serviceRecords} 
              availableAppointments={appointmentsRes.data || []}
              customer={customer}
            />
        </TabsContent>

        {/* ABA INFORMAÇÕES DO CLIENTE */}
        <TabsContent value="info" className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 rounded-lg text-primary">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone/WhatsApp</p>
                  <p className="text-sm font-medium">{customer.phone || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 rounded-lg text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="text-sm font-medium">{customer.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 rounded-lg text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="text-sm font-medium">{customer.address || 'Não informado'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Observações Internas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border min-h-[120px]">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {customer.notes || "Nenhuma observação interna registrada."}
                </p>
              </div>
            </CardContent>
          </Card>
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
    case 'confirmed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'canceled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'arrived': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
    default: return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
}