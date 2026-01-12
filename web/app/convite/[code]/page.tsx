import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  const { code } = resolvedParams
  
  // 1. Busca o convite com Admin (para ver o nome da empresa)
  const supabaseAdmin = createAdminClient()
  
  const { data: invite } = await supabaseAdmin
    .from('invitations')
    .select('*, organizations(name, niche)')
    .eq('code', code)
    .single() as any

  // Validação: Se não existe ou expirou
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-2" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>Este link já foi utilizado ou expirou.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Se não logado, manda pro Login
  if (!user) {
    const returnUrl = encodeURIComponent(`/convite/${code}`)
    redirect(`/login?next=${returnUrl}`)
  }

  // === AÇÃO DE ACEITE ===
  async function acceptInvite() {
    'use server'
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    
    if (!user) return
    
    // 1. Vincula o usuário à organização
    await sb.from('profiles').update({
      organization_id: invite.organization_id,
      role: invite.role
    }).eq('id', user.id)

    // 2. QUEIMA O CONVITE (Deleta para ninguém mais usar)
    const admin = createAdminClient()
    await admin.from('invitations').delete().eq('id', invite.id)

    redirect('/dashboard')
  }

  return (
    <div className="h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md text-center shadow-lg bg-card">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Convite para Equipe</CardTitle>
          <CardDescription className="text-base mt-2">
            Você foi convidado para integrar a equipe de:
            <br />
            <strong className="text-foreground text-lg">{invite.organizations?.name}</strong>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50 text-left">
            <Avatar>
              <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">Entrando como:</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <form action={acceptInvite}>
            <Button className="w-full font-semibold" size="lg">
              Aceitar e Acessar Painel
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground px-4">
            Atenção: Este é um link de uso único. Ao aceitar, ele será invalidado.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}