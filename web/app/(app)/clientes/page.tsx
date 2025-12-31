import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { 
  Users, Search, UserPlus, Phone, Mail, 
  ChevronRight, FileText, Calendar 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CreateCustomerDialog } from "@/components/create-customer-dialog"

export const metadata: Metadata = {
  title: "Pacientes | Eliza",
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const supabase = await createClient()
  const query = searchParams?.q || ""

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations_id')
    .eq('id', user.id)
    .single() as any

  // Busca pacientes com filtro de busca se houver query
  let customerQuery = supabase
    .from('customers')
    .select('*') // Agora vai encontrar full_name, document, etc.
    .eq('organizations_id', profile.organizations_id)
    .order('full_name')

  if (query) {
    customerQuery = customerQuery.ilike('full_name', `%${query}%`)
  }

  const { data: customers } = await customerQuery as any;

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-zinc-400 text-sm">
            Gerencie o cadastro e histórico clínico dos seus pacientes.
          </p>
        </div>
        <CreateCustomerDialog organizations_id={profile.organizations_id} />
      </div>

      {/* Barra de Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <form method="GET">
          <Input 
            name="q"
            placeholder="Buscar por nome..." 
            defaultValue={query}
            className="pl-10 bg-zinc-900/50 border-zinc-800 focus:ring-blue-500"
          />
        </form>
      </div>

      <div className="grid gap-4">
        {customers?.map((customer: any) => (
          <Link key={customer.id} href={`/clientes/${customer.id}`}>
            <Card className="bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/80 transition-all group cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <span className="text-blue-500 font-bold text-lg">
                      {customer.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
                      {customer.full_name}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {customer.phone || 'Sem telefone'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {customer.document || 'Sem CPF'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end text-xs text-zinc-600">
                    <span>Paciente desde</span>
                    <span>{new Date(customer.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {customers?.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-xl">
            <Users className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500">Nenhum paciente encontrado.</p>
          </div>
        )}
      </div>
    </div>
  )
}