'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { updateSettings } from "@/app/actions/update-settings"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

export function SettingsForm({ tenant }: { tenant: any }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const result = await updateSettings(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Configurações salvas com sucesso!")
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Dados Institucionais</CardTitle>
          <CardDescription className="text-zinc-400">
            Essas informações serão exibidas no cabeçalho dos prontuários e receitas.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300">Nome da Clínica</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={tenant.name} 
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100"
                placeholder="Ex: Consultório Dr. João Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="crm" className="text-zinc-300">Registro Profissional (CRM/CRP)</Label>
              <Input 
                id="crm" 
                name="crm" 
                defaultValue={tenant.crm || ''} 
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100"
                placeholder="Ex: CRM/MG 123456"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document" className="text-zinc-300">CPF ou CNPJ</Label>
              <Input 
                id="document" 
                name="document" 
                defaultValue={tenant.document || ''} 
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100"
                placeholder="Documento para nota fiscal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-zinc-300">Telefone de Contato</Label>
              <Input 
                id="phone" 
                name="phone" 
                defaultValue={tenant.phone || ''} 
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">Email Comercial</Label>
            <Input 
              id="email" 
              name="email" 
              type="email"
              defaultValue={tenant.email || ''} 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100"
              placeholder="contato@clinic.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-zinc-300">Endereço Completo</Label>
            <Textarea 
              id="address" 
              name="address" 
              defaultValue={tenant.address || ''} 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 text-zinc-100 min-h-[80px]"
              placeholder="Rua, Número, Bairro, Cidade - Estado, CEP"
            />
          </div>
        </CardContent>

        <CardFooter className="border-t border-zinc-800 px-6 py-4">
          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}