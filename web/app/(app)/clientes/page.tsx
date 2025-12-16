import { createClient } from "@/utils/supabase/server"
import { CreatePatientDialog } from "@/components/create-patient-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Mail, Users } from "lucide-react"

export default async function ClientesPage() {
  const supabase = await createClient()

  // Buscar pacientes do banco
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Meus Pacientes</h1>
          <p className="text-zinc-400 text-sm">Gerencie o cadastro e histórico dos seus pacientes.</p>
        </div>
        <CreatePatientDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customers?.map((customer) => (
          <Card key={customer.id} className="bg-zinc-900 border-zinc-800 text-zinc-100 hover:border-blue-900 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-zinc-700">
                  <AvatarImage src="" /> 
                  <AvatarFallback className="bg-blue-900 text-blue-200 font-bold">
                    {customer.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{customer.name}</h3>
                  <p className="text-xs text-zinc-500">Paciente</p>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Phone className="h-4 w-4 text-blue-500" />
                  <span>{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <span>{customer.email}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {customers?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/50">
            <Users className="h-10 w-10 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm">Cadastre o primeiro paciente para começar os agendamentos.</p>
          </div>
        )}
      </div>
    </div>
  )
}