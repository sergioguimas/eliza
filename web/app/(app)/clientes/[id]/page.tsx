import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Phone, User, Calendar, FileText, Printer, Pencil, Trash2, Send } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { EditCustomerDialog } from "@/components/edit-customer-dialog"
import { MedicalRecordForm } from "@/components/medical-record-form"

export default async function PacienteDetalhesPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const supabase = await createClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single() as any;

  if (!customer) notFound();

  const { data: notes } = await supabase
  .from('medical_records')
  .select('*')
  .eq('customer_id', id)
  .order('created_at', { ascending: false }) as any

  // 2. Busca o histórico de agendamentos deste paciente
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(name, color)')
    .eq('customer_id', id)
    .order('start_time', { ascending: false }) as any

  return (
    <div className="p-8 bg-black min-h-screen text-zinc-100">
      {/* Cabeçalho de Ações */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href="/clientes">
            <Button variant="ghost" size="icon" className="bg-zinc-900 border border-zinc-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{customer.full_name}</h1>
            <div className="flex gap-4 mt-1 text-sm text-zinc-500">
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> Gênero: {customer.gender || 'N/D'}</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {customer.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="bg-zinc-900 border-zinc-800"><Printer className="mr-2 h-4 w-4" /> Histórico</Button>
          <EditCustomerDialog customer={customer} />
          <Button variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* Abas de Navegação */}
      <Tabs defaultValue="prontuario" className="w-full space-y-6">
        {/* Ajuste do Flex: grid-cols-3 garante distribuição igualitária */}
        <TabsList className="grid w-full grid-cols-3 bg-zinc-900 border border-zinc-800 h-12">
          <TabsTrigger value="dados" className="data-[state=active]:bg-zinc-800">Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="prontuario" className="data-[state=active]:bg-zinc-800">Prontuário</TabsTrigger>
          <TabsTrigger value="historico" className="data-[state=active]:bg-zinc-800">Histórico</TabsTrigger>
        </TabsList>

        {/* Aba: Dados Cadastrais */}
        <TabsContent value="dados" className="space-y-4 outline-none">
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Nome Completo</p>
                <p className="text-zinc-100">{customer.full_name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase font-semibold">WhatsApp / Telefone</p>
                <p className="text-zinc-100">{customer.phone || 'Não informado'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Documento (CPF)</p>
                <p className="text-zinc-100">{customer.document || 'Não informado'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase font-semibold">Gênero</p>
                <p className="text-zinc-100">{customer.gender || 'Não definido'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba: Prontuário */}
        <TabsContent value="prontuario" className="space-y-6 outline-none">
          <Card className="bg-zinc-900/40 border-zinc-800">
            <CardContent className="p-6">
              <MedicalRecordForm customerId={id} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Histórico de Evoluções</h3>
            {notes && notes.length > 0 ? (
              notes.map((note: any) => (
                <Card key={note.id} className="bg-zinc-900/60 border-zinc-800">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Anotação clínica</span>
                      <span>{new Date(note.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-zinc-200 whitespace-pre-wrap text-sm leading-relaxed">
                      {note.content}
                    </p>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-8 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600 text-sm">
                Nenhuma anotação registrada anteriormente.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Aba: Histórico de Agendamentos */}
        <TabsContent value="historico" className="outline-none">
          <div className="grid gap-4">
            {appointments && appointments.length > 0 ? (
              appointments.map((app: any) => (
                <Card key={app.id} className="bg-zinc-900/40 border-zinc-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: app.services?.color || '#3b82f6' }} />
                      <div>
                        <p className="font-bold text-zinc-100">{app.services?.name}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(app.start_time).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 capitalize">
                      {app.status}
                    </span>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600">
                Nenhum agendamento encontrado para este paciente.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}