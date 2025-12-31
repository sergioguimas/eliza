'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { updateProfile } from "@/app/actions/update-profile"
import { toast } from "sonner"
import { Loader2, UserCog } from "lucide-react"

export function ProfileForm({ profile }: { profile: any }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const result = await updateProfile(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Seus dados foram atualizados!")
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Meus Dados Profissionais</CardTitle>
          <CardDescription className="text-zinc-400">
            Essas informações aparecerão na assinatura dos seus documentos.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name" className="text-zinc-300">Nome de Exibição</Label>
            <Input 
              id="full_name" 
              name="full_name" 
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
              placeholder="Ex: Dr. Pedro Santos"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user_crm" className="text-zinc-300">Documento</Label>
              <Input 
                id="user_crm" 
                name="crm" 
                defaultValue={profile.crm || ''} 
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                placeholder="CRM/MG 00000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="specialty" className="text-zinc-300">Especialidade</Label>
              <Input 
                id="specialty" 
                name="specialty" 
                defaultValue={profile.specialty || ''} 
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                placeholder="Ex: Dermatologista"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t border-zinc-800 px-6 py-4">
          <Button type="submit" disabled={loading} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
            Salvar Meu Perfil
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}