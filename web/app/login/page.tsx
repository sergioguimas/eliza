'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { login, signup } from '../actions/auth'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const action = isLogin ? login : signup

    try {
      const result = await action(formData)
      // Se a action retornar algo, é erro (pois o sucesso faz redirect)
      if (result?.error) {
        toast.error(result.error)
      }
    } catch (e) {
      toast.error("Ocorreu um erro inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-2xl text-emerald-400">
            {isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isLogin 
              ? 'Entre para gerenciar seus agendamentos.' 
              : 'Comece seu trial gratuito agora.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa / Seu Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Barbearia do Zé" required className="bg-zinc-950 border-zinc-800" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="voce@exemplo.com" required className="bg-zinc-950 border-zinc-800" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required className="bg-zinc-950 border-zinc-800" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading}>
              {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
            </Button>
            <p className="text-sm text-center text-zinc-500">
              {isLogin ? "Não tem conta? " : "Já tem conta? "}
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-400 hover:underline"
              >
                {isLogin ? "Cadastre-se" : "Faça Login"}
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}