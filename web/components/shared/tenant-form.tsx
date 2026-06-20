'use client'

import { createTenant } from "@/app/actions/admin-create-tenant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRef } from "react"

export function TenantForm() {
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    const result = await createTenant(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(
        result?.message ||
          "Organização criada. Um link de definição de senha foi enviado ao responsável."
      )
      formRef.current?.reset()
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName" className="mb-2 block">
          Nome da organização
        </Label>
        <Input
          id="orgName"
          name="orgName"
          placeholder="Ex: Empresa Exemplo"
          required
        />
      </div>

      <div>
        <Label htmlFor="email" className="mb-2 block">
          E-mail do responsável
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="contato@empresa.com"
          required
        />
      </div>

      <Button type="submit" className="w-full">
        Criar organização e enviar acesso
      </Button>
    </form>
  )
}