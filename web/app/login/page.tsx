'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { login, signup } from '../actions/auth'
import { Stethoscope } from 'lucide-react'

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
      <div className="absolute top-8 left-8 flex items-center gap-2 text-blue-500 font-bold text-xl">
        <Stethoscope className="h-6 w-6" />
        MedAgenda
      </div>

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader>
          <CardTitle className="text-2xl text-blue-400">
            {isLogin ? 'Acessar Clínica' : 'Cadastrar Consultório'}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isLogin 
              ? 'Entre para gerenciar sua agenda médica.' 
              : 'Comece seu trial gratuito para gestão de pacientes.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Clínica / Médico</Label>
                <Input id="name" name="name" placeholder="Ex: Clínica Saúde Total" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
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
              {isLogin ? "Ainda não usa o MedAgenda? " : "Já possui cadastro? " }
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