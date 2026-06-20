'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { signIn, signUp } from '@/app/actions/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = searchParams.get('next')
  const isInvite = next?.includes('/convite/')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    const action = isLogin ? signIn : signUp

    try {
      const result = await action(formData)

      if (result?.error) {
        toast.error(result.error)
        return
      }

      if (isLogin && result?.success) {
        router.push(result.redirectTo || next || '/dashboard')
        router.refresh()
        return
      }

      if (!isLogin && result?.success) {
        toast.success(
          typeof result.success === 'string'
            ? result.success
            : 'Cadastro realizado com sucesso.'
        )
      }
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível concluir a solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl text-primary">
          {isLogin ? 'Acessar conta' : 'Criar conta de acesso'}
        </CardTitle>

        <CardDescription className="text-muted-foreground">
          {isLogin
            ? 'Entre com suas credenciais.'
            : isInvite
              ? 'Crie sua conta para aceitar o convite.'
              : 'Crie sua conta para começar a usar o sistema.'}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <input
          type="hidden"
          name="redirectTo"
          value={next || (isLogin ? '/dashboard' : '/setup')}
        />

        <CardContent className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">
                {isInvite ? 'Seu nome completo' : 'Nome da organização ou responsável'}
              </Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder={isInvite ? 'Ex: Ana Silva' : 'Ex: Empresa Exemplo'}
                required
                className="bg-background border-input focus:ring-ring"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="mb-2 block">
              E-mail
            </Label>
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
            <Label htmlFor="password" className="mb-2 block">
              Senha
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              className="bg-background border-input focus:ring-ring"
            />
            {isLogin && (
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </Link>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="mt-5 px-8 border" disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isLogin ? (
              'Entrar'
            ) : (
              'Cadastrar'
            )}
          </Button>

          {isInvite && (
            <div className="text-center text-sm mt-5">
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