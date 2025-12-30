import { Metadata } from "next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/utils/supabase/server"
import { CreateServiceDialog } from "@/components/create-service-dialog"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Serviços | Eliza",
  description: "Gerencie os procedimentos e serviços da sua clínica.",
}

export default async function ServicesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Não autorizado</div>
  }

  // 1. Buscar Perfil com Organization ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div className="p-8">Você precisa estar vinculado a uma organização.</div>
  }

  // 2. Buscar Serviços (Usando nomes novos: name, duration, active)
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('name', { ascending: true })

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Serviços</h2>
        <div className="flex items-center space-x-2">
          <CreateServiceDialog />
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Procedimentos</CardTitle>
          <CardDescription>
            Gerencie os preços e durações dos seus atendimentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum serviço cadastrado.
                  </TableCell>
                </TableRow>
              )}
              
              {services?.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>{service.duration} min</TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(service.price)}
                  </TableCell>
                  <TableCell>
                    {service.active ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-700">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Futuramente você pode adicionar botão de editar aqui */}
                    <Button variant="ghost" size="sm" disabled>Editar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}