import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, Plus, Ban, CheckCircle } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export default async function AdminPage() {
  const supabase = await createClient()

  // 1. Verificação de Segurança (Dupla checagem)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.email !== process.env.NEXT_PUBLIC_GOD_EMAIL) {
    redirect('/dashboard')
  }

  // 2. Busca todas as organizações usando o Admin Client (bypassa RLS)
  const supabaseAdmin = createAdminClient()
  
  const { data: organizations, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel Super Admin</h1>
                <p className="text-slate-500">Visão geral de todos os tenants do sistema.</p>
            </div>
          </div>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href="/admin/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar Nova Organização
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total de Clínicas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{organizations?.length || 0}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                        {organizations?.filter((o: any) => o.status === 'active').length || 0}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Suspensas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                        {organizations?.filter((o: any) => o.status !== 'active').length || 0}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Tabela de Tenants */}
        <div className="bg-white rounded-lg border shadow-sm">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Nome da Organização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Nicho</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {organizations?.map((org: any) => (
                <TableRow key={org.id}>
                    <TableCell className="font-medium">
                        {org.name || "Sem Nome"}
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{org.id}</div>
                    </TableCell>
                    <TableCell>
                        <Badge variant={org.status === 'active' ? 'default' : 'destructive'}>
                            {org.status === 'active' ? 'Ativo' : 'Suspenso'}
                        </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                        {org.niche || "Genérico"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                        {format(new Date(org.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/org/${org.id}`}>Gerenciar</Link>
                        </Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </div>
    </div>
  )
}