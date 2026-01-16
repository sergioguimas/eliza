import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, FileText, User, ShieldAlert, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

import { UpdateCustomerDialog } from "@/components/update-customer-dialog"
// Novos componentes "Keckleon"
import { ServiceRecordForm } from "@/components/service-record-form"
import { ServiceRecordList } from "@/components/service-record-list"

import { getDictionary } from "@/lib/get-dictionary"

export default async function ClienteDetalhesPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  // 1. CORREÇÃO DO ERRO: Aguarda os parâmetros
  const { id } = await params
  
  const supabase = await createClient()

  // 2. Busca o Usuário Logado para saber o Nicho
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations(niche)')
    .eq('id', user.id)
    .single() as any

  const niche = profile?.organizations?.niche || 'generico'
  const dict = getDictionary(niche)

  // 3. Busca dados do Cliente
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) {
    notFound()
  }

  // 4. Busca Agendamentos
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(title)')
    .eq('customer_id', id)
    .order('start_time', { ascending: false })

  const isActive = customer.active !== false

  // Helper para iniciais
  const getInitials = (name: string) => {
    return (name || "Cliente")
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8 animate-in fade-in duration-500">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link href="/clientes">
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-dashed">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
          </Link>
          
          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-background shadow-sm">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                {getInitials(customer.name || " ")}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.name}</h1>
                <Badge variant={isActive ? "default" : "destructive"} className="rounded-full px-3">
                  {isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {customer.phone || "Sem telefone"}
                </span>
                {customer.email && (
                   <span className="flex items-center gap-1.5 hidden sm:flex">
                    <Mail className="h-3.5 w-3.5" /> {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <UpdateCustomerDialog customer={customer}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Editar Dados
          </Button>
        </UpdateCustomerDialog>
      </div>

      <Separator />

      {/* --- CONTEÚDO --- */}
      <Tabs defaultValue="historico" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12">
          <TabsTrigger value="historico" className="h-10">{dict.label_prontuario}s</TabsTrigger>
          <TabsTrigger value="agendamentos" className="h-10">Agendamentos</TabsTrigger>
          <TabsTrigger value="dados" className="h-10">Perfil</TabsTrigger>
        </TabsList>

        {/* ABA 1: HISTÓRICO (REFATORADO) */}
        <TabsContent value="historico" className="space-y-8">
            {/* Formulário de Criação */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" />
                Novo Registro
              </h2>
              {/* Note o uso correto de customerId (camelCase) */}
              <ServiceRecordForm customerId={id} />
            </div>

            <Separator className="my-6" />

            {/* Lista de Histórico */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-muted-foreground pl-1">
                Histórico Completo
              </h2>
              <ServiceRecordList customerId={id} />
            </div>
        </TabsContent>

        {/* ABA 2: AGENDAMENTOS */}
        <TabsContent value="agendamentos" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            {appointments && appointments.length > 0 ? (
              appointments.map((app) => (
                <Card key={app.id} className="overflow-hidden hover:shadow-sm transition-all duration-200 border-l-4" style={{ borderLeftColor: getStatusColorHex(app.status) }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-muted p-2 rounded-md">
                        <Calendar className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{app.services?.title || 'Serviço Personalizado'}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            {new Date(app.start_time).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(app.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`capitalize px-2 py-0.5 text-xs ${getStatusBadgeStyle(app.status)}`}>
                      {translateStatus(app.status)}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-xl bg-muted/10 col-span-full">
                <div className="bg-muted p-3 rounded-full mb-3">
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium">Sem agendamentos</h3>
                <p className="text-xs text-muted-foreground">Este cliente ainda não possui horários marcados.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 3: PERFIL */}
        <TabsContent value="dados">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" /> 
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 p-3 rounded-lg bg-muted/20 border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="font-medium text-sm">{customer.email || "—"}</p>
                </div>
                
                <div className="space-y-1 p-3 rounded-lg bg-muted/20 border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Phone className="h-3 w-3" /> Telefone
                  </p>
                  <p className="font-medium text-sm">{customer.phone || "—"}</p>
                </div>

                <div className="space-y-1 p-3 rounded-lg bg-muted/20 border">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Documento</p>
                   <p className="font-medium text-sm">{customer.document || "—"}</p>
                </div>

                 <div className="space-y-1 p-3 rounded-lg bg-muted/20 border">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nascimento</p>
                   <p className="font-medium text-sm">
                    {customer.birth_date 
                      ? new Date(customer.birth_date).toLocaleDateString('pt-BR') 
                      : "—"}
                   </p>
                </div>
                
                <div className="space-y-1 md:col-span-2 p-3 rounded-lg bg-muted/20 border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Endereço
                  </p>
                  <p className="font-medium text-sm">{customer.address || "Endereço não cadastrado"}</p>
                </div>

                <div className="space-y-1 md:col-span-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                   <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="h-3 w-3" /> Observações Internas
                   </p>
                   <p className="text-xs text-yellow-700 mt-1">
                      {customer.notes || "Nenhuma observação interna."}
                   </p>
                </div>
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