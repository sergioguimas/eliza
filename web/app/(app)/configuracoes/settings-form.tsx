'use client'

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateSettings } from "@/app/actions/update-settings"
import { toast } from "sonner"
import { Loader2, Save, Building2, User, Share2, QrCode } from "lucide-react"
import { WhatsappSettings } from "./whatsapp-settings"

export function SettingsForm({ profile }: { profile: any }) {
  const [loading, setLoading] = useState(false)
  const organization = profile?.organizations

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const formData = new FormData(event.currentTarget)
    const result = await updateSettings(formData)
    setLoading(false)

    if (result?.error) toast.error(result.error)
    else toast.success("Configurações salvas!")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="user_id" value={profile?.id} />
      <input type="hidden" name="org_id" value={profile?.organizations_id || ''} />

      <Tabs defaultValue="organizacao" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="organizacao" className="gap-2"><Building2 className="h-4 w-4" /> Clínica</TabsTrigger>
          <TabsTrigger value="profissional" className="gap-2"><User className="h-4 w-4" /> Profissional</TabsTrigger>
          <TabsTrigger value="api" className="gap-2"><Share2 className="h-4 w-4" /> Integração</TabsTrigger>
        </TabsList>

        {/* ABA 1: ORGANIZAÇÃO */}
        <TabsContent value="organizacao">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle>Dados da Clínica</CardTitle>
              <CardDescription>Informações institucionais e de contato.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da Clínica</Label>
                <Input id="name" name="name" defaultValue={organization?.name} className="bg-zinc-950 border-zinc-800" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="document">CPF/CNPJ</Label>
                  <Input id="document" name="document" defaultValue={organization?.document} className="bg-zinc-950 border-zinc-800" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone Comercial</Label>
                  <Input id="phone" name="phone" defaultValue={organization?.phone} className="bg-zinc-950 border-zinc-800" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail Comercial</Label>
                <Input id="email" name="email" type="email" defaultValue={organization?.email} className="bg-zinc-950 border-zinc-800" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea id="address" name="address" defaultValue={organization?.address} className="bg-zinc-950 border-zinc-800 min-h-[80px]" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: PROFISSIONAL */}
        <TabsContent value="profissional">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle>Seu Perfil Profissional</CardTitle>
              <CardDescription>Como você será identificado nas comunicações.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome de Exibição</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name} className="bg-zinc-950 border-zinc-800" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="crm">Registro Profissional (CRM/CRP)</Label>
                <Input id="crm" name="crm" defaultValue={organization?.crm} className="bg-zinc-950 border-zinc-800" placeholder="Ex: CRM/SP 123456" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: EVOLUTION API */}
        <TabsContent value="api">
          {/* Aqui injetamos o seu componente que já tem a lógica de QR Code e Connect */}
          <WhatsappSettings />
          
          <Card className="mt-4 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-sm">Configurações Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                  <Label htmlFor="evolution_url">URL da Instância (Ngrok)</Label>
                  <Input 
                    id="evolution_url" 
                    name="evolution_url" 
                    defaultValue={organization?.evolution_url || 'http://localhost:8082'} 
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs" 
                  />
              </div>
              <div className="grid gap-2">
                  <Label htmlFor="evolution_apikey">API Key (Global)</Label>
                  <Input 
                    id="evolution_apikey" 
                    name="evolution_apikey" 
                    type="password" 
                    defaultValue={organization?.evolution_apikey || 'medagenda123'} 
                    className="bg-zinc-950 border-zinc-800 font-mono text-xs" 
                  />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-white font-bold">
        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
        Salvar Todas as Alterações
      </Button>
    </form>
  )
}