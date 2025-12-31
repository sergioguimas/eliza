import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Stethoscope, Plus, Pencil, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CreateServiceDialog } from "@/components/create-service-dialog"
import { deleteService } from "@/app/actions/create-service"
import { Trash2 } from "lucide-react"
import { DeleteServiceButton } from "@/components/delete-service-button"

export const metadata: Metadata = {
  title: "Procedimentos | Eliza",
}

export default async function ProcedimentosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('organizations_id', profile.organizations_id)
    .order('name')

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Procedimentos</h1>
          <p className="text-zinc-400 text-sm">
            Gerencie o catálogo de serviços e especialidades da sua clínica.
          </p>
        </div>
        
        <CreateServiceDialog organizations_id={profile.organizations_id} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services?.map((service) => (
          <Card key={service.id} className={cn(
            "bg-zinc-900/50 border-zinc-800 transition-all",
            !service.active && "opacity-60"
          )}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Stethoscope className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex gap-2">
                  <CreateServiceDialog 
                    organizations_id={profile.organizations_id} 
                    serviceToEdit={service} 
                  />
                  
                  {/* Novo componente de cliente que lida com o clique */}
                  <DeleteServiceButton serviceId={service.id} />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg text-zinc-100">{service.name}</h3>
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <span>{service.duration} min</span>
                  <span className="h-1 w-1 rounded-full bg-zinc-700" />
                  <span>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {services?.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500">Nenhum procedimento cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}