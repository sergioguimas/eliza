import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, FileText } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EditCustomerDialog } from "@/components/edit-customer-dialog"
import { MedicalRecordForm } from "@/components/medical-record-form"

export default async function ClienteDetalhesPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const supabase = await createClient()

  // 1. Busca dados do Cliente
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) {
    console.error("Erro ao buscar cliente:", error)
    notFound()
  }

  // 2. Busca Agendamentos (com dados do serviço)
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(title)')
    .eq('customer_id', id)
    .order('start_time', { ascending: false })

  // 3. Busca Histórico de Atendimentos (Antigo Prontuário)
  const { data: recordsData } = await supabase
    .from('medical_records')
    .select(`
      *,
      professional:profiles!professional_id (
        full_name
      )
    `)
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const records = recordsData?.map(rec => ({
    ...rec,
    profiles: rec.professional
  })) || []

  const isActive = customer.active

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <Badge variant={isActive ? "default" : "destructive"} className="capitalize">
                {isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Phone className="h-3 w-3" /> {customer.phone || "Sem telefone"}
            </p>
          </div>
        </div>
        
        <EditCustomerDialog customer={customer} />
      </div>

      {/* --- CONTEÚDO EM ABAS --- */}
      <Tabs defaultValue="historico" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="historico">Atendimentos</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
        </TabsList>

        {/* ABA 1: HISTÓRICO DE ATENDIMENTOS (CORE) */}
        <TabsContent value="historico" className="mt-6 space-y-6">
            
            {/* Área de Novo Registro */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Novo Registro
              </h2>
              <MedicalRecordForm customer_id={id} />
            </div>

            <hr className="border-border" />

            {/* Lista de Registros Anteriores */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                Histórico Completo
              </h2>
              
              {records && records.length > 0 ? (
                records.map((rec) => (
                  <MedicalRecordForm 
                    key={rec.id} 
                    customer_id={id} 
                    record={rec} 
                    professionalName={rec.professional?.full_name || ""}
                  />
                ))
              ) : (
                <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm">Nenhum registro de atendimento encontrado.</p>
                </div>
              )}
            </div>
        </TabsContent>

        {/* ABA 2: AGENDAMENTOS */}
        <TabsContent value="agendamentos" className="mt-6">
          <div className="grid gap-4">
            {appointments && appointments.length > 0 ? (
              appointments.map((app) => (
                <Card key={app.id} className="overflow-hidden">
                  <div className={`h-1 w-full ${getStatusColor(app.status)}`} />
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{app.services?.title || 'Serviço'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(app.start_time).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(app.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {translateStatus(app.status)}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
                Nenhum agendamento encontrado para este cliente.
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 3: DADOS CADASTRAIS */}
        <TabsContent value="dados" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Contato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </p>
                <p>{customer.email || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Telefone
                </p>
                <p>{customer.phone || "—"}</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Endereço
                </p>
                <p>{customer.address || "Endereço não cadastrado"}</p>
              </div>
              
              <div className="space-y-1">
                 <p className="text-sm font-medium text-muted-foreground">Documento (CPF/CNPJ)</p>
                 <p>{customer.document || "—"}</p>
              </div>
               <div className="space-y-1">
                 <p className="text-sm font-medium text-muted-foreground">Data de Nascimento</p>
                 <p>{customer.birth_date ? new Date(customer.birth_date).toLocaleDateString('pt-BR') : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}

// --- Funções Auxiliares de UI ---

function getStatusColor(status: string | null) {
  if (!status) return 'bg-gray-500' // Cor padrão se vier sem status

  switch (status) {
    case 'confirmed': return 'bg-green-500'
    case 'canceled': return 'bg-red-500'
    case 'completed': return 'bg-blue-500'
    case 'arrived': return 'bg-indigo-500'
    default: return 'bg-yellow-500'
  }
}

function translateStatus(status: string | null) {
  if (!status) return 'Pendente' // Texto padrão se vier sem status

  const map: Record<string, string> = {
    'scheduled': 'Agendado',
    'confirmed': 'Confirmado',
    'canceled': 'Cancelado',
    'completed': 'Concluído',
    'arrived': 'Chegou'
  }
  return map[status] || status
}