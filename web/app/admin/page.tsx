import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toggleOrgStatus } from "./actions"
import { Ban, CheckCircle, ShieldAlert, Plus, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // CORREÇÃO 1: Usar a mesma variável de ambiente da Sidebar
  const godEmail = process.env.NEXT_PUBLIC_GOD_EMAIL

  if (!godEmail || !user || user.email !== godEmail) {
    return redirect('/dashboard')
  }

  // CORREÇÃO 2: Verificar se a chave de serviço existe antes de tentar usar
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-red-500 space-y-4">
        <AlertTriangle className="h-12 w-12" />
        <h1 className="text-xl font-bold">Erro de Configuração</h1>
        <p>A variável <code>SUPABASE_SERVICE_ROLE_KEY</code> não foi encontrada no servidor.</p>
        <p className="text-sm text-muted-foreground">Adicione ela no seu arquivo .env.local (pegue no painel do Supabase &gt; Settings &gt; API).</p>
      </div>
    )
  }

  const supabaseAdmin = createAdminClient()
  
  // Tratamento de erro na busca
  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Erro ao carregar organizações: {error.message}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* CABEÇALHO DO PAINEL */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-full">
            <ShieldAlert className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Super Admin</h1>
            <p className="text-muted-foreground">Gestão global de assinantes.</p>
          </div>
        </div>

        <div className="flex gap-4 items-center">
            <div className="bg-card border px-4 py-2 rounded-lg shadow-sm text-right">
                <span className="text-2xl font-bold block leading-none">{orgs?.length || 0}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Empresas</span>
            </div>
            <Button asChild>
                <Link href="/admin/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Organização
                </Link>
            </Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Nicho</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs?.map((org: any) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">
                  {org.name}
                  <div className="text-xs text-muted-foreground font-mono">{org.id.slice(0, 8)}...</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {org.plan || 'Free'}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{org.niche}</TableCell>
                <TableCell>{new Date(org.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  {org.status === 'active' ? (
                    <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-500/20">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Suspenso</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <form action={async () => {
                    'use server'
                    await toggleOrgStatus(org.id, org.status)
                  }}>
                    {org.status === 'active' ? (
                      <Button size="sm" variant="destructive" className="h-8">
                        <Ban className="w-4 h-4 mr-2" />
                        Bloquear
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-600 hover:text-green-700 hover:bg-green-50">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Ativar
                      </Button>
                    )}
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}