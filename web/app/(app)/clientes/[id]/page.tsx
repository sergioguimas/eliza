import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, FileText, Phone, Mail, User } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"

export default async function CustomerProfilePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // 1. Buscar dados do Cliente
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!customer) {
    return notFound()
  }

  // 2. Buscar Histórico
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, services(title, color)')
    .eq('customer_id', params.id)
    .order('start_time', { ascending: false })

  return (
    <div className="space-y-8">
      
      {/* CABEÇALHO DO PERFIL */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-zinc-900 p-8 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-zinc-800">
            <AvatarFallback className="bg-blue-600 text-3xl font-bold text-white">
              {customer.name ? customer.name.substring(0, 2).toUpperCase() : 'PN'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">{customer.name}</h1>
            <div className="flex flex-col md:flex-row gap-2 md:gap-6 mt-2 text-zinc-400">
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {customer.phone}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-zinc-700">Editar Dados</Button>
          <Button className="bg-blue-600 hover:bg-blue-700">Nova Consulta</Button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Detalhes */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-xs text-zinc-500 block">Status</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                  Ativo
                </Badge>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Cadastrado em</span>
                <span className="text-sm">
                  {/* CORREÇÃO AQUI: Se for null, usa a data atual como fallback para não quebrar */}
                  {format(new Date(customer.created_at || new Date()), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Gênero</span>
                <span className="text-sm capitalize">{customer.gender || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">Observações</span>
                <p className="text-sm text-zinc-400 italic">
                  {customer.notes || "Nenhuma observação registrada."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Abas */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="bg-zinc-900 border border-zinc-800 w-full justify-start rounded-lg p-1">
              <TabsTrigger value="history">Histórico de Consultas</TabsTrigger>
              <TabsTrigger value="records">Prontuário Médico</TabsTrigger>
              <TabsTrigger value="files">Arquivos & Exames</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-6 space-y-4">
              {!appointments?.length ? (
                <div className="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
                  <Calendar className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                  <p className="text-zinc-500">Nenhum atendimento realizado ainda.</p>
                </div>
              ) : (
                appointments.map((appt) => (
                  <Card key={appt.id} className="bg-zinc-900 border-zinc-800 hover:bg-zinc-900/80 transition-colors">
                    <CardContent className="flex items-center gap-4 p-4">
                      {/* Data em Destaque */}
                      <div className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg h-16 w-16 min-w-[4rem]">
                        <span className="text-xs text-zinc-500 uppercase font-bold">
                          {/* CORREÇÃO AQUI: Garantindo que start_time existe */}
                          {appt.start_time && format(parseISO(appt.start_time), 'MMM', { locale: ptBR })}
                        </span>
                        <span className="text-xl font-bold text-zinc-200">
                          {appt.start_time && format(parseISO(appt.start_time), 'dd')}
                        </span>
                      </div>

                      {/* Detalhes */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {/* @ts-ignore */}
                          <h3 className="font-semibold text-zinc-200">{appt.services?.title}</h3>
                          <div 
                            className="w-2 h-2 rounded-full" 
                            /* @ts-ignore */
                            style={{ backgroundColor: appt.services?.color || '#3b82f6' }}
                          />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {/* CORREÇÃO AQUI: */}
                            {appt.start_time && format(parseISO(appt.start_time), 'HH:mm')}
                          </span>
                          <span className="flex items-center gap-1 capitalize">
                            <User className="h-3 w-3" />
                            Dr. Padrão
                          </span>
                        </div>
                      </div>

                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                        {appt.status === 'confirmed' ? 'Realizada' : 'Agendada'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="records" className="mt-6">
              <Card className="bg-zinc-900 border-zinc-800 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <FileText className="h-10 w-10 mb-4 opacity-50" />
                  <p>Funcionalidade de Prontuário em desenvolvimento.</p>
                  <Button variant="link" className="text-blue-500">Clique para adicionar nota rápida</Button>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  )
}