import { createClient } from "@/utils/supabase/server"
import { createClient as createClientAdmin } from "@supabase/supabase-js"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, Plus, LayoutDashboard, CheckCircle2, Ban, Building2 } from "lucide-react"
import Link from "next/link"
import { toggleOrgStatus } from "./actions"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const godEmail = process.env.NEXT_PUBLIC_GOD_EMAIL

  if (!user || user.email !== godEmail) {
    return redirect('/dashboard')
  }

  const supabaseAdmin = createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const { data: organizations, error } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Erro ao buscar orgs:", error)
  }

  const orgList = organizations || []

  return (
    <div className="min-h-screen bg-muted/40 p-8 space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Super Admin</h1>
            <p className="text-muted-foreground">Gestão global de assinantes.</p>
          </div>
        </div>

        {/* BOTÕES E MÉTRICA UNIFORMES */}
        <div className="flex items-center gap-2 h-10">
            <div className="flex items-center gap-2 px-4 h-full bg-background border rounded-md shadow-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-foreground">{orgList.length}</span>
                <span className="text-xs uppercase text-muted-foreground font-semibold">Empresas</span>
            </div>
            
            <div className="w-px h-6 bg-border mx-1" /> {/* Separador visual */}

            <Button asChild variant="default" className="h-full shadow-sm">
                <Link href="/admin/new">
                    <Plus className="mr-2 h-4 w-4" /> Nova Organização
                </Link>
            </Button>

            <Button asChild variant="outline" className="h-full bg-background">
                <Link href="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
            </Button>
        </div>
      </div>

      {/* TABELA */}
      <Card className="shadow-sm">
        <CardHeader className="px-6 py-8 border-b bg-background/50">
             <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Empresas Cadastradas</CardTitle>
                    <CardDescription>Visão geral de todos os tenants do sistema.</CardDescription>
                </div>
             </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 h-10 align-middle">Empresa</TableHead>
                <TableHead className="h-10 align-middle">Plano</TableHead>
                <TableHead className="h-10 align-middle">Nicho</TableHead>
                <TableHead className="h-10 align-middle">Criado em</TableHead>
                <TableHead className="h-10 align-middle">Status</TableHead>
                <TableHead className="text-right pr-6 h-10 align-middle">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgList.map((org: any) => {
                const status = org.subscription_status || 'active' 
                const isActive = status === 'active'

                return (
                  <TableRow key={org.id} className="group">
                    <TableCell className="font-medium pl-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{org.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono opacity-70 group-hover:opacity-100 transition-opacity">
                          {org.slug}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                        <Badge variant="secondary" className="uppercase text-[10px] font-bold tracking-wider">
                            {org.plan || 'free'}
                        </Badge>
                    </TableCell>
                    <TableCell className="capitalize py-3 text-sm">{org.niche}</TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge 
                        variant="outline" 
                        className={isActive 
                            ? "border-green-200 text-green-700 bg-green-50" 
                            : "border-red-200 text-red-700 bg-red-50"
                        }
                      >
                        {isActive ? 'Ativo' : 'Suspenso'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3">
                      
                      <form 
                        action={async () => {
                            'use server'
                            await toggleOrgStatus(org.id, status)
                        }}
                        className="flex justify-end"
                      >
                        <Button 
                            variant={isActive ? "ghost" : "outline"} 
                            size="sm"
                            className={isActive 
                                ? "text-red-600 hover:bg-red-600 hover:text-white transition-colors h-8 px-3" 
                                : "text-green-600 border-green-200 hover:bg-green-600 hover:text-white transition-colors h-8 px-3"
                            }
                        >
                            {isActive ? (
                                <>
                                    <Ban className="mr-2 h-3.5 w-3.5" /> Suspender
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Ativar
                                </>
                            )}
                        </Button>
                      </form>

                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}