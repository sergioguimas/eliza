import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { MedicalRecordList } from "@/components/medical-record-list"
import { MedicalRecordForm } from "@/components/medical-record-form"
import { CustomerDetailsHeader } from "@/components/customer-details-header"

export default async function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Buscar Dados do Cliente
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (!customer) {
    return notFound()
  }

  // 2. Buscar Prontuários
  const { data: records } = await supabase
    .from('medical_records')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto">
      
      <CustomerDetailsHeader customer={customer} />

      <Tabs defaultValue="records" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 w-full justify-start h-auto p-1 mb-8">
          <TabsTrigger value="info" className="data-[state=active]:bg-zinc-800">Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="records" className="data-[state=active]:bg-zinc-800">Prontuário</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-zinc-800">Histórico de Agendamentos</TabsTrigger>
        </TabsList>

        {/* Aba Prontuário */}
        <TabsContent value="records" className="space-y-6">
           <MedicalRecordForm customerId={id} />
           
           {!records?.length ? (
              <div className="text-center py-8 border border-zinc-800 border-dashed rounded-lg">
                <p className="text-zinc-500 text-sm">Nenhuma anotação registrada.</p>
              </div>
            ) : (
              <MedicalRecordList records={records} customerId={id} />
            )}
        </TabsContent>

        {/* Aba Informações (Visualização rápida extra) */}
        <TabsContent value="info">
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <h3 className="font-medium text-zinc-100 mb-4">Informações Detalhadas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4 text-sm">
              <div>
                <span className="block text-zinc-500 mb-1">Email</span>
                <span className="text-zinc-200">{customer.email || '-'}</span>
              </div>
              <div>
                <span className="block text-zinc-500 mb-1">Telefone</span>
                <span className="text-zinc-200">{customer.phone || '-'}</span>
              </div>
              <div>
                <span className="block text-zinc-500 mb-1">Gênero</span>
                <span className="text-zinc-200 capitalize">{customer.gender || '-'}</span>
              </div>
              <div className="col-span-1 md:col-span-2">
                <span className="block text-zinc-500 mb-1">Observações</span>
                <p className="text-zinc-300 leading-relaxed bg-zinc-950/50 p-3 rounded-md border border-zinc-800/50">
                  {customer.notes || 'Sem observações registradas.'}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Aba Histórico */}
        <TabsContent value="history">
          <div className="text-center py-12 text-zinc-500 border border-zinc-800 border-dashed rounded-lg">
             Histórico de agendamentos em breve.
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}