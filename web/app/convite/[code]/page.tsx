import { createClient } from "@/utils/supabase/server"
import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { RegisterForm } from "./register-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle, Building2 } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: { params: { code: string } }) {
  // Configura cliente Admin para ler o convite sem restrição de RLS
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  
  // Busca dados do convite + Nome da Organização
  const { data: invite } = await (supabaseAdmin.from('invitations') as any)
    .select(`*, organizations ( name, niche )`)
    .eq('code', params.code)
    .single()

  //CONVITE INVÁLIDO OU EXPIRADO
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Convite Inválido</CardTitle>
            <CardDescription>
              Este link não existe, já foi utilizado ou expirou.
              <br/>Peça um novo link ao administrador.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const orgName = invite.organizations?.name || "Empresa"

  //CONVITE VÁLIDO -> MOSTRAR FORMULÁRIO
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md shadow-xl bg-card">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Convite para Equipe</CardTitle>
          <CardDescription className="text-base mt-2">
            Você foi convidado para integrar o time da:
            <br />
            <strong className="text-foreground text-lg">{orgName}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground text-center">
            Crie sua conta abaixo para aceitar o convite e acessar o painel imediatamente.
          </div>

          <RegisterForm inviteCode={params.code} assignedEmail={invite.email} />
          
        </CardContent>
      </Card>
    </div>
  )
}