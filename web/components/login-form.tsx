'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { signIn, signUp } from '@/app/actions/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Captura o destino e verifica se é um convite
  const next = searchParams.get('next')
  const isInvite = next?.includes('/convite/')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const action = isLogin ? signIn : signUp

    try {
      const result = await action(formData) as any

      if (result?.error) {
        toast.error(result.error)
      } else if (result?.success) {
        if (isLogin) {
          router.push(next || '/dashboard')
          router.refresh()
        } else {
          toast.success(result.success as string)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">
          {isLogin ? 'Acessar Conta' : 'Criar Conta de Acesso'}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isLogin 
            ? 'Entre com suas credenciais.' 
            : isInvite 
              ? 'Crie sua conta para aceitar o convite.' 
              : 'Comece seu trial gratuito.'}
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        {/* CAMPO IMPORTANTE: Leva o destino para o servidor */}
        <input type="hidden" name="redirectTo" value={next || (isLogin ? '/dashboard' : '/setup')} />

        <CardContent className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">
                {isInvite ? 'Seu Nome Completo' : 'Nome da Clínica / Médico'}
              </Label>
              <Input 
                id="fullName" 
                name="fullName" 
                placeholder={isInvite ? "Ex: Ana Silva" : "Ex: Clínica Saúde Total"} 
                required 
                className="bg-background border-input focus:ring-ring" 
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="mb-2 block">Email</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="seu@email.com" 
              required 
              className="bg-background border-input focus:ring-ring" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="mb-2 block">Senha</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="bg-background border-input focus:ring-ring" 
            />
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <br></br>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isLogin ? 'Entrar' : 'Cadastrar')}
          </Button>

          {/* SÓ MOSTRA O BOTÃO "CRIAR CONTA" SE FOR CONVITE */}
          {isInvite && (
            <div className="text-center text-sm">
              {isLogin ? (
                <p className="text-muted-foreground">
                  É seu primeiro acesso?{' '}
                  <button 
                    type="button" 
                    onClick={() => setIsLogin(false)} 
                    className="text-primary hover:underline font-medium"
                  >
                    Criar conta
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Já tem conta?{' '}
                  <button 
                    type="button" 
                    onClick={() => setIsLogin(true)} 
                    className="text-primary hover:underline font-medium"
                  >
                    Fazer login
                  </button>
                </p>
              )}
            </div>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}