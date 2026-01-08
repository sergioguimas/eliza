import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, FileText, User, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EditCustomerDialog } from "@/components/edit-customer-dialog"
import { MedicalRecordForm } from "@/components/medical-record-form"
import { Separator } from "@/components/ui/separator"

export default async function ClienteDetalhesPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const supabase = await createClient()

  // 1. Busca dados
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) notFound()

  // 2. Busca Agendamentos
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(title)')
    .eq('customer_id', id)
    .order('start_time', { ascending: false })

  // 3. Busca Histórico (Safe)
  const { data: records } = await supabase
    .from('medical_records')
    .select('*, professional:profiles!professional_id(full_name)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const safeRecords = records as any[] || []
  const isActive = customer.active !== false

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="container max-w-5xl py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border bg-background">
              <AvatarFallback className="text-xl bg-primary/5 text-primary font-bold">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <Badge variant={isActive ? "default" : "secondary"} className="text-xs px-2 h-5">
                  {isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5"/> {customer.phone || "—"}</span>
                {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5"/> {customer.email}</span>}
              </div>
            </div>
          </div>
        </div>
        
        <EditCustomerDialog customer={customer} />
      </div>

      <Separator />

      {/* ABAS (LARGURA TOTAL) */}
      <Tabs defaultValue="historico" className="w-full">
        {/* w-full aqui garante que o menu ocupe a largura inteira */}
        <TabsList className="w-full grid grid-cols-3 h-11 mb-6">
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
        </TabsList>

        {/* 1. HISTÓRICO */}
        <TabsContent value="historico" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">Novo Registro</h2>
              <MedicalRecordForm customer_id={id} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between pl-1">
                 <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Linha do Tempo</h2>
              </div>
              
              {safeRecords.length > 0 ? (
                safeRecords.map((rec) => (
                  <MedicalRecordForm 
                    key={rec.id} 
                    customer_id={id} 
                    record={rec} 
                    professionalName={rec.professional?.full_name || ""}
                  />
                ))
              ) : (
                <div className="py-12 text-center border-2 border-dashed rounded-lg bg-muted/5">
                  <p className="text-muted-foreground text-sm">Nenhum registro encontrado.</p>
                </div>
              )}
            </div>
        </TabsContent>

        {/* 2. AGENDAMENTOS */}
        <TabsContent value="agendamentos" className="space-y-4">
          <div className="grid gap-3">
            {appointments && appointments.length > 0 ? (
              appointments.map((app) => (
                <Card key={app.id} className="overflow-hidden hover:bg-muted/5 transition-colors border-l-4" style={{ borderLeftColor: getStatusColorHex(app.status) }}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-2 rounded-md">
                        <Calendar className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{app.services?.title || 'Serviço'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(app.start_time).toLocaleDateString('pt-BR')}</span>
                          <span>•</span>
                          <span>{new Date(app.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs border-0 ${getStatusBadgeStyle(app.status)}`}>
                      {translateStatus(app.status)}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-12 text-center border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground text-sm">Sem agendamentos.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 3. DADOS */}
        <TabsContent value="dados">
          <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Dados Cadastrais</CardTitle></CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem label="Email" value={customer.email} icon={<Mail className="h-3 w-3"/>} />
                <InfoItem label="Telefone" value={customer.phone} icon={<Phone className="h-3 w-3"/>} />
                <InfoItem label="Documento" value={customer.document} />
                <InfoItem label="Nascimento" value={customer.birth_date ? new Date(customer.birth_date).toLocaleDateString('pt-BR') : null} />
                <div className="md:col-span-2">
                    <InfoItem label="Endereço" value={customer.address} icon={<MapPin className="h-3 w-3"/>} />
                </div>
                {customer.notes && (
                    <div className="md:col-span-2 p-3 bg-yellow-50 rounded border border-yellow-200 text-sm">
                        <span className="font-bold text-yellow-700 block mb-1">Observações:</span>
                        {customer.notes}
                    </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente simples para dados (evita repetição)
function InfoItem({ label, value, icon }: { label: string, value: string | null, icon?: React.ReactNode }) {
    return (
        <div className="space-y-1 p-3 bg-muted/20 rounded border">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                {icon} {label}
            </p>
            <p className="text-sm font-medium">{value || "—"}</p>
        </div>
    )
}

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