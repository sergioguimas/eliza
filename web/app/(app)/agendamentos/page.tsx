import { createClient } from "@/utils/supabase/server"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Clock, User } from "lucide-react"

// Função auxiliar para formatar data (Ex: 25/10 às 14:00)
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default async function AgendamentosPage() {
  const supabase = await createClient()

  // 1. Buscar os Agendamentos (com os nomes dos clientes e serviços via JOIN)
  // O Supabase permite buscar dados relacionados assim:
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      *,
      customers (name),
      services (title)
    `)
    .order('start_time', { ascending: true })

  // 2. Buscar Listas para o Modal (Dropdowns)
  const { data: customers } = await supabase.from('customers').select('id, name')
  const { data: services } = await supabase.from('services').select('id, title, price')

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Agenda Médica</h1>
          <p className="text-zinc-400 text-sm">Gerencie as consultas marcadas.</p>
        </div>
        {/* Passamos as listas para o componente Client-Side aqui 👇 */}
        <CreateAppointmentDialog 
          customers={customers || []} 
          services={services || []} 
        />
      </div>

      <div className="space-y-4">
        {appointments?.map((apt) => (
          <Card key={apt.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
            
            {/* Coluna da Hora */}
            <div className="flex flex-col items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800 min-w-[100px]">
              <span className="text-blue-400 font-bold text-xl">
                {new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}
              </span>
              <span className="text-zinc-500 text-xs">
                {new Date(apt.start_time).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Coluna dos Detalhes */}
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {/* O TypeScript pode reclamar que é array, mas como é relação 1:1, tratamos como objeto */}
                {/* @ts-ignore */}
                <User className="h-4 w-4 text-zinc-500" /> {apt.customers?.name || 'Cliente Removido'}
              </h3>
              <div className="text-zinc-400 flex items-center gap-2 text-sm">
                {/* @ts-ignore */}
                <span className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-900/50">
                  {apt.services?.title}
                </span>
                <span className="flex items-center gap-1 text-zinc-500 text-xs">
                  <Clock className="h-3 w-3" /> 
                  {/* Cálculo simples de duração se quiser mostrar */}
                  Duração estimada
                </span>
              </div>
            </div>

            {/* Coluna de Status */}
            <div>
               <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                 Confirmado
               </span>
            </div>

          </Card>
        ))}

        {appointments?.length === 0 && (
          <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            <Calendar className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <p>Nenhum agendamento futuro.</p>
          </div>
        )}
      </div>
    </div>
  )
}