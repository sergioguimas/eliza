import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { 
  Users, Search, Phone, 
  ChevronRight, FileText 
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CreateCustomerDialog } from "@/components/create-customer-dialog"
import { getDictionary } from "@/lib/get-dictionary"
import { CategoryIcon } from "@/components/category-icon"
import { Database } from "@/utils/database.types"

type ProfileWithOrg = Database['public']['Tables']['profiles']['Row'] & {
  organizations: Pick<Database['public']['Tables']['organizations']['Row'], 'niche'> | null
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient<Database>()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { title: "Eliza" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations(niche)')
    .eq('id', user.id)
    .single()

  const niche = profile?.organizations?.niche || 'generico'
  const dict = getDictionary(niche)

  return {
    title: `${dict.label_cliente}s | Eliza`,
  }
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient<Database>()
  const query = (await searchParams)?.q || ""

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(`*, organizations (niche)`)
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/configuracoes')

  // Busca pacientes filtrando pela organização
  let customerQuery = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', profile.organization_id) 
    .order('active', { ascending: false })
    .order('name', { ascending: true })

  if (query) {
    customerQuery = customerQuery.ilike('name', `%${query}%`)
  }

  const { data: customers } = await customerQuery as any;

  const niche = (profile as ProfileWithOrg)?.organizations?.niche || 'generico';
  const dict = getDictionary(niche)

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground capitalize">
            {dict.label_cliente}s
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie o cadastro e histórico dos seus {dict.label_cliente}s.
          </p>
        </div>
        <CreateCustomerDialog />
      </div>

      {/* Barra de Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <form method="GET">
          <Input 
            name="q"
            placeholder={`Buscar ${dict.label_cliente}...`}
            defaultValue={query}
            className="pl-10 bg-background border-input focus:ring-ring"
          />
        </form>
      </div>

      <div className="grid gap-4">
        {customers?.map((customer: any) => {
          const isActive = customer.active !== false;

          return (
            <Link 
              key={customer.id} 
              href={`/clientes/${customer.id}`} 
              prefetch={false}
              className="block group"
            >
              <Card className={cn(
                "bg-card border-border hover:bg-accent/50 transition-all cursor-pointer relative overflow-hidden",
                !isActive && "opacity-75 border-destructive/20"
              )}>
                
                {!isActive && (
                  <div className="absolute top-0 right-0 bg-destructive/10 border-l border-b border-destructive/20 px-3 py-1">
                    <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Inativo</span>
                  </div>
                )}

                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* ÍCONE DE PERFIL (Avatar) */}
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center border transition-colors",
                      isActive 
                        ? "bg-primary/10 border-primary/20" 
                        : "bg-muted border-border"
                    )}>
                      {/* Aqui mantemos a inicial, é elegante e genérico */}
                      <span className={cn(
                        "font-bold text-lg",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}>
                        {customer.name?.charAt(0).toUpperCase() || "C"}
                      </span>
                    </div>

                    <div>
                      <h3 className={cn(
                        "font-bold transition-colors",
                        isActive 
                          ? "text-foreground group-hover:text-primary" 
                          : "text-muted-foreground"
                      )}>
                        {customer.name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {customer.phone || 'Sem telefone'}
                        </span>
                        {/* Removemos o CPF da listagem rápida para limpar o visual, ou mantenha se for vital */}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <ChevronRight className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-muted-foreground group-hover:text-foreground" : "text-muted"
                    )} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}

        {customers?.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-xl">
            {/* ÍCONE DE EMPTY STATE DINÂMICO */}
            <div className="flex justify-center mb-4">
               <CategoryIcon name="clientes" className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">Nenhum {dict.label_cliente} encontrado.</p>
          </div>
        )}
      </div>
    </div>
  )
}