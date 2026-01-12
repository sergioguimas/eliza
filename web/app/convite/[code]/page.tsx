import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  const { code } = resolvedParams
  const supabase = await createClient()

  // 1. Validar o Código
  const { data: invite } = await supabase
    .from('invitations')
    .select('*, organizations(name, niche)')
    .eq('code', code)
    .single() as any

  // Se código inválido ou expirado
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-2" />
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>Este link não existe ou já expirou.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // 2. Usuário está logado?
  const { data: { user } } = await supabase.auth.getUser()

  // SE NÃO ESTIVER LOGADO: Redireciona para cadastro, mas volta pra cá depois
  if (!user) {
    const returnUrl = encodeURIComponent(`/convite/${code}`)
    redirect(`/login?next=${returnUrl}`)
  }

  // 3. AÇÃO: Aceitar o convite (Server Action Inline para simplicidade)
  async function acceptInvite() {
    'use server'
    const sb = await createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    
    // Atualiza o perfil do usuário para pertencer à organização
    await sb.from('profiles').update({
      organization_id: invite.organization_id,
      role: invite.role
    }).eq('id', user.id)

    // Opcional: Incrementar contador de uso
    // await sb.rpc('increment_invite_usage', { invite_id: invite.id })

    redirect('/dashboard')
  }

  return (
    <div className="h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Você foi convidado!</CardTitle>
          <CardDescription>
            Para fazer parte da equipe de <strong>{invite.organizations?.name}</strong>.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-2 p-4 border rounded-lg bg-background">
            <Avatar>
              <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-medium">Entrar como:</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <form action={acceptInvite}>
            <Button className="w-full" size="lg">
              Aceitar e Acessar Painel
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground">
            Ao aceitar, você terá acesso imediato aos dados da organização.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}