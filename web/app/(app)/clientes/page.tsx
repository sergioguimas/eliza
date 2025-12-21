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
import { Search, MoreHorizontal, UserPlus } from "lucide-react"
import Link from "next/link"
import { CustomerRowActions } from "@/components/customer-row-actions"

// CORREÇÃO 1: Tipagem de searchParams como Promise
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>
}) {
  const supabase = await createClient()
  
  // CORREÇÃO 2: Aguardar (await) os parâmetros antes de ler
  const { query } = await searchParams
  const searchQuery = query || ""

  // Busca clientes filtrando pelo nome se houver busca
  let queryBuilder = supabase
    .from('customers')
    .select('*')
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

      {/* Área de Filtro e Busca */}
      <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800 w-full md:w-96">
        <Search className="h-4 w-4 text-zinc-500 ml-2" />
        <Input 
          placeholder="Buscar paciente por nome..." 
          className="border-0 bg-transparent focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-600"
          name="query"
          defaultValue={searchQuery} // Boa prática: manter o valor no input
        />
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Nome</TableHead>
              <TableHead className="text-zinc-400">Email</TableHead>
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
                <TableCell className="text-zinc-400">{customer.email || '-'}</TableCell>
                <TableCell className="text-zinc-400">{customer.phone || '-'}</TableCell>
                <TableCell className="text-zinc-400 capitalize">{customer.gender || '-'}</TableCell>
                <TableCell className="text-right">
                  <CustomerRowActions customer={{ id: customer.id, name: customer.name }} />
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