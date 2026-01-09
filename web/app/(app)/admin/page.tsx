'use client'

import { createTenant } from "@/app/actions/admin-create-tenant"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function NovoClientePage() {
  async function handleSubmit(formData: FormData) {
    const res = await createTenant(formData)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(res.message)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded-lg bg-card">
      <h1 className="text-xl font-bold mb-4">Painel God Mode: Novo Cliente</h1>
      <form action={handleSubmit} className="space-y-4">
        <div>
          <Label>Nome da Clínica</Label>
          <Input name="orgName" placeholder="Ex: Clínica Saúde Vida" required />
        </div>
        
        <div>
          <Label>Email de Acesso (Login)</Label>
          <Input name="email" type="email" placeholder="cliente@clinica.com" required />
        </div>

        <div>
          <Label>Senha Inicial</Label>
          <Input name="password" type="text" placeholder="Senha forte" required />
        </div>

        <Button type="submit" className="w-full">Criar Cliente & Organização</Button>
      </form>
    </div>
  )
}