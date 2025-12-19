import { createClient } from "@/utils/supabase/server"
import { CreateServiceDialog } from "@/components/create-service-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, DollarSign } from "lucide-react"

export default async function ServicesPage() {
  const supabase = await createClient()

  // Buscando os serviços ativos
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('title')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Procedimentos</h1>
          <p className="text-zinc-400">Gerencie seu catálogo de serviços.</p>
        </div>
        <CreateServiceDialog />
      </div>

      {!services?.length ? (
        <div className="text-center py-20 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
          <p className="text-zinc-500">Nenhum procedimento cadastrado.</p>
          <p className="text-sm text-zinc-600">Clique no botão acima para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 overflow-hidden relative group">
              {/* Faixa lateral colorida */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5" 
                style={{ backgroundColor: service.color || '#3b82f6' }} 
              />
              
              <CardHeader className="pb-2 pl-6">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                  {service.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="pl-6 space-y-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="font-bold text-zinc-200">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price || 0)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>{service.duration_minutes} minutos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}