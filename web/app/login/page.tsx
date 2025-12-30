'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { signIn, signUp } from '../actions/auth'
import { Stethoscope } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
        // Sucesso!
        if (isLogin) {
          // Se for login, redireciona para o dashboard
          router.push('/dashboard')
          router.refresh() // Garante que os dados do usuário atualizem
        } else {
          // Se for cadastro, mostra a mensagem
          toast.success(result.success as string)
          setIsLogin(true) // Opcional: Joga o usuário para a tela de login
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
    // ... O restante do seu JSX continua igual (Input name="fullName", etc)
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      {/* ... conteúdo igual ao anterior ... */}
      <div className="absolute top-8 left-8 flex items-center gap-2 text-blue-500 font-bold text-xl">
        <Stethoscope className="h-6 w-6" />
        Eliza
      </div>

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-400">
            {isLogin ? 'Acessar Clínica' : 'Cadastrar Consultório'}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isLogin 
              ? 'Entre para gerenciar sua agenda.' 
              : 'Comece seu trial gratuito para gestão de contatos.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome da Clínica / Médico</Label>
                <Input 
                  id="fullName" 
                  name="fullName" 
                  placeholder="Ex: Clínica Saúde Total" 
                  required 
                  className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email Corporativo</Label>
              <Input id="email" name="email" type="email" placeholder="doutor@clinica.com" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
              {loading ? 'Processando...' : (isLogin ? 'Entrar no Sistema' : 'Criar Conta')}
            </Button>
            <p className="text-sm text-center text-zinc-500">
              {isLogin ? "Ainda não usa o Eliza? " : "Já possui cadastro? " }
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-400 hover:underline"
              >
                {isLogin ? "Criar conta" : "Fazer Login"}
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}