import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LockKeyhole, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default function SuspendedPage() {

  // === AÇÃO DE LOGOUT (Server Action) ===
  async function logout() {
    'use server'
    const supabase = await createClient()
    
    // 1. Apaga o cookie de sessão
    await supabase.auth.signOut()
    
    // 2. Manda pro login
    redirect('/login')
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-destructive/50 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto bg-destructive/10 p-4 rounded-full w-fit">
            <LockKeyhole className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">Acesso Temporariamente Suspenso</CardTitle>
          <CardDescription className="text-base">
            Identificamos uma pendência na assinatura da sua organização.
            O acesso ao painel foi bloqueado temporariamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Para regularizar o acesso imediato e evitar perda de dados, entre em contato com nosso suporte financeiro.
          </p>
          
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full font-semibold" variant="default">
              <Link href="https://wa.me/5533999791305" target="_blank">
                Falar com Financeiro
              </Link>
            </Button>
            
            <form action={logout}>
                <Button variant="ghost" className="w-full hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair e Voltar ao Login
                </Button>
            </form>

          </div>
        </CardContent>
      </Card>
    </div>
  )
}