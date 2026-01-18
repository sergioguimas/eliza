'use client'

import { createTenant } from "@/app/actions/admin-create-tenant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRef } from "react"
import { useKeckleon } from "@/providers/keckleon-provider"

export function TenantForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const { dict } = useKeckleon()

  async function handleSubmit(formData: FormData) {
    // 1. Chama a Server Action
    const result = await createTenant(formData)

    // 2. Lida com o resultado no Cliente
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(result?.message || "Cliente criado com sucesso!")
      formRef.current?.reset()
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName" className="mb-2 block">Nome da Empresa</Label>
        <Input id="orgName" name="orgName" placeholder="Ex: Clínica Saúde Vida" required />
      </div>
      
      <div>
        <Label htmlFor="email" className="mb-2 block">Email de Acesso</Label>
        <Input id="email" name="email" type="email" placeholder="cliente@clinica.com" required />
      </div>

      <div>
        <Label htmlFor="password" className="mb-2 block">Senha Inicial</Label>
        <Input id="password" name="password" type="text" placeholder="Senha forte" required />
      </div>

      <Button type="submit" className="w-full">Criar Cliente</Button>
    </form>
  )
}