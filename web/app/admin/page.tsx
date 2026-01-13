import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle, ArrowRight, LogIn } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params
  const { code } = resolvedParams
  const supabase = await createClient()
  
  // 1. Verifica Usuário Logado
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Busca o convite (Usando AdminClient para ler dados da Org mesmo sem ser membro ainda)
  const supabaseAdmin = createAdminClient()
  
  const { data: invite } = await supabaseAdmin
    .from('invitations')
    .select('*, organizations(name, niche)')
    .eq('code', code)
    .single() as any

  // 3. Validação: Se não existe ou expirou
  if (!invite || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
               <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Convite Inválido ou Expirado</CardTitle>
            <CardDescription>
              Este link não está mais disponível. Peça um novo convite ao administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
             <Button asChild variant="outline">
                <Link href="/">Voltar ao Início</Link>
             </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // === SERVER ACTION DE ACEITE ===
  async function acceptInvite() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return redirect('/login') // Redundância

    // 1. Atualiza o perfil do usuário
    const { error } = await supabase
        .from('profiles')
        .update({ 
            organization_id: invite.organization_id,
            role: invite.role // <--- APLICA O CARGO DEFINIDO NO CONVITE
        })
        .eq('id', user.id)

    if (error) {
        console.error("Erro ao aceitar:", error)
        return // Tratar erro visualmente se necessário
    }

    // 2. Marca convite como usado ou deleta
    await supabaseAdmin.from('invitations').delete().eq('code', code) 
    
    // 3. Redireciona para o Dashboard
    redirect('/dashboard')
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-2xl border-primary/20">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4 animate-bounce">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Convite para Equipe</CardTitle>
          <CardDescription className="text-base mt-2">
            Você foi convidado para integrar a equipe de:
            <br />
            <strong className="text-foreground text-xl block mt-1">{invite.organizations?.name}</strong>
            <span className="text-xs bg-muted px-2 py-1 rounded-full mt-2 inline-block capitalize">
                Função: {invite.role === 'professional' ? 'Profissional' : 'Secretaria/Staff'}
            </span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          
          {user ? (
              // SE JÁ ESTÁ LOGADO
              <>
                <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30 text-left">
                    <Avatar>
                    <AvatarFallback>{user.email?.[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                    <p className="text-sm font-medium text-foreground">Entrando como:</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                </div>

                <form action={acceptInvite}>
                    <Button className="w-full font-bold h-12 text-lg" size="lg">
                    Aceitar e Acessar Painel <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </form>
              </>
          ) : (
              // SE NÃO ESTÁ LOGADO
              <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                      Para aceitar o convite, você precisa entrar ou criar uma conta.
                  </p>
                  <Button asChild className="w-full" size="lg">
                      <Link href={`/login?next=/convite/${code}`}>
                        <LogIn className="mr-2 h-4 w-4" />
                        Entrar ou Criar Conta
                      </Link>
                  </Button>
              </div>
          )}
          
          <p className="text-xs text-muted-foreground px-4">
            Ao aceitar, você terá acesso imediato aos dados e agenda desta organização conforme sua função.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}