'use client'

import { useState } from "react"
import { registerStaffFromInvite } from "@/app/actions/register-staff"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function RegisterForm({ inviteCode, assignedEmail }: { inviteCode: string, assignedEmail?: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    formData.append('invite_code', inviteCode) // Adiciona o código oculto

    const result = await registerStaffFromInvite(formData)

    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success("Conta criada com sucesso!")
      // Redireciona para login
      router.push('/login?message=Conta criada! Faça login para continuar.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome Completo</Label>
        <Input 
          id="full_name" 
          name="full_name" 
          placeholder="Ex: João Silva" 
          required 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail Profissional</Label>
        <Input 
          id="email" 
          name="email" 
          type="email" 
          defaultValue={assignedEmail || ''}
          readOnly={!!assignedEmail}
          className={assignedEmail ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
          placeholder="seu@email.com" 
          required 
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Crie uma Senha</Label>
        <Input 
          id="password" 
          name="password" 
          type="password" 
          placeholder="Mínimo 6 caracteres" 
          required 
          minLength={6}
        />
      </div>

      <Button type="submit" className="w-full mt-2" size="lg" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {loading ? "Criando conta..." : "Criar Conta e Entrar"}
      </Button>
    </form>
  )
}