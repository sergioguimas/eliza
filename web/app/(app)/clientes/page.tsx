import { createClient } from "@/utils/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateCustomerDialog } from "@/components/create-customer-dialog"
import { Search, UserPlus } from "lucide-react"
import Link from "next/link"
import { CustomerRowActions } from "@/components/customer-row-actions"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>
}) {
  const supabase = await createClient()
  
  // Parâmetros de busca (Next.js 15)
  const { query } = await searchParams
  const searchQuery = query || ""

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>Não autorizado</div>

  // 1. Buscar Organization ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div className="p-8">Você precisa estar vinculado a uma organização.</div>
  }

  // 2. Query segura filtrando pela organização
  let queryBuilder = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', profile.organization_id) // <--- O FILTRO MÁGICO
    .order('name')

  if (searchQuery) {
    queryBuilder = queryBuilder.ilike('name', `%${searchQuery}%`)
  }

  const { data: customers } = await queryBuilder

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Pacientes</h1>
          <p className="text-zinc-400">Gerencie os dados e histórico dos seus pacientes.</p>
        </div>
        <CreateCustomerDialog />
      </div>

      <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 w-full md:w-96">
        <Search className="h-4 w-4 text-zinc-500 ml-2" />
        <Input 
          placeholder="Buscar paciente por nome..." 
          className="border-0 bg-transparent focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-600"
          name="query"
          defaultValue={searchQuery}
        />
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Nome</TableHead>
              <TableHead className="text-zinc-400">Telefone</TableHead>
              <TableHead className="text-zinc-400">Gênero</TableHead>
              <TableHead className="text-right text-zinc-400">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.map((customer) => (
              <TableRow key={customer.id} className="border-zinc-800 hover:bg-zinc-900/50 group">
                <TableCell className="font-medium">
                  <Link 
                    href={`/clientes/${customer.id}`} 
                    className="flex items-center gap-2 text-zinc-200 hover:text-blue-400 transition-colors font-semibold py-2"
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-bold group-hover:bg-blue-900/30 group-hover:text-blue-400 transition-colors">
                      {customer.name ? customer.name.substring(0, 2).toUpperCase() : 'PN'}
                    </div>
                    {customer.name}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-400">{customer.phone || '-'}</TableCell>
                <TableCell className="text-zinc-400 capitalize">{customer.gender || '-'}</TableCell>
                <TableCell className="text-right">
                  <CustomerRowActions customer={customer} />
                </TableCell>
              </TableRow>
            ))}
            
            {!customers?.length && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UserPlus className="h-8 w-8 opacity-20" />
                    <p>Nenhum paciente encontrado.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}