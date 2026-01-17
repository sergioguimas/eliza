import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CreateServiceDialog } from "@/components/create-service-dialog"
import { DeleteServiceButton } from "@/components/delete-service-button"
import { getDictionary } from "@/lib/get-dictionary" 
import { CategoryIcon } from "@/components/category-icon"

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { title: "Eliza" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations(niche)')
    .eq('id', user.id)
    .single() as any

  const niche = profile?.organizations?.niche || 'generico'
  const dict = getDictionary(niche)

  return {
    title: `${dict.label_servico}s | Eliza`,
  }
}

export default async function ProcedimentosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id) redirect('/setup')

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('title') 

  const { data: organization } = await supabase
    .from('organizations')
    .select('niche')
    .eq('id', profile.organization_id)
    .single() as any
  const niche = organization?.niche || 'generico'
  const dict = getDictionary(niche)

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{dict.label_servico}s</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie o catálogo de {dict.label_servico}s.
          </p>
        </div>

        <CreateServiceDialog organization_id={profile.organization_id} />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services?.map((service: any) => (
            <Card key={service.id} className={cn(
              "bg-card border-border transition-all border-l-4 hover:bg-accent/50",
              !service.is_active && "opacity-60" 
            )}
            style={{ borderLeftColor: service.color || '#3b82f6' }}
            >
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CategoryIcon name="servicos" className="h-5 w-5 text-primary" />
                </div>
                <div className="flex gap-2">
                  <CreateServiceDialog 
                    organization_id={profile.organization_id} 
                    serviceToEdit={service} 
                  />
                  <DeleteServiceButton serviceId={service.id} />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground">{service.title}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{service.duration_minutes} min</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {services?.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-xl">
            <p className="text-muted-foreground">Nenhum {dict.label_servico}s cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}