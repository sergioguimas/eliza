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
  const next = searchParams.get('next') || undefined

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
          router.push('/dashboard')
          router.refresh()
        } else {
          toast.success(result.success as string)
          setIsLogin(true)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error("Ocorreu um erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">
          {isLogin ? 'Acessar Clínica' : 'Cadastrar Consultório'}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isLogin 
            ? 'Entre para gerenciar sua agenda.' 
            : 'Comece seu trial gratuito para gestão de contatos.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="redirectTo" value={next || (isLogin ? '/dashboard' : '/setup')} />
        <CardContent className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome da Clínica / Médico</Label>
              <Input 
                id="fullName" 
                name="fullName" 
                placeholder="Ex: Clínica Saúde Total" 
                required 
                className="bg-background border-input focus:ring-ring" 
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email Corporativo</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="doutor@clinica.com" 
              required 
              className="bg-background border-input focus:ring-ring" 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="bg-background border-input focus:ring-ring" 
            />
          </div>
        </CardContent>
        <br></br>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isLogin ? 'Entrar no Sistema' : 'Criar Conta')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}