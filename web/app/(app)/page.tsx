import { createClient } from "@/utils/supabase/server"
import { CreateServiceDialog } from "@/components/create-service-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, DollarSign, Activity } from "lucide-react"

export default async function ServicesPage() {
  const supabase = await createClient()

  // Busca os procedimentos do banco
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Procedimentos & Consultas</h1>
          <p className="text-zinc-400 text-sm">Gerencie o catálogo de atendimento da clínica.</p>
        </div>
        <CreateServiceDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services?.map((service) => (
          <Card key={service.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-blue-900 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold truncate pr-2">
                {service.title}
              </CardTitle>
              <div className={`h-2 w-2 rounded-full ${service.is_active ? 'bg-blue-500' : 'bg-zinc-500'}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-zinc-400 mt-2">
                <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded">
                  <DollarSign className="h-3 w-3 text-emerald-400" />
                  <span>R$ {service.price?.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1 bg-zinc-950 px-2 py-1 rounded">
                  <Clock className="h-3 w-3 text-blue-400" />
                  <span>{service.duration_minutes} min</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {services?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50">
            <Activity className="h-10 w-10 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum procedimento encontrado</p>
            <p className="text-sm">Comece cadastrando sua primeira consulta ou exame.</p>
          </div>
        )}
      </div>
    </div>
  )
}