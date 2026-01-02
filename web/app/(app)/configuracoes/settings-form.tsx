'use client'

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateSettings } from "@/app/actions/update-settings"
import { WhatsappSettings } from "./whatsapp-settings"
import { sendTestMessage } from "@/app/actions/whatsapp-test"
import { toast } from "sonner"
import { Loader2, Save, Building2, User, Share2 } from "lucide-react"

export function SettingsForm({ profile }: { profile: any }) {
  const [loading, setLoading] = useState(false)
  const organization = profile?.organizations

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* CAMPOS OCULTOS DE SEGURANÇA: Garantem que os IDs e o Nome sejam enviados independente da aba aberta */}
      <input type="hidden" name="user_id" value={profile?.id} />
      <input type="hidden" name="org_id" value={profile?.organizations_id || ''} />
      <input type="hidden" name="name" value={organization?.name || ''} />

      <Tabs defaultValue="organizacao" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="organizacao" className="gap-2 text-zinc-400 data-[state=active]:text-zinc-100">
            <Building2 className="h-4 w-4" /> Clínica
          </TabsTrigger>
          <TabsTrigger value="profissional" className="gap-2 text-zinc-400 data-[state=active]:text-zinc-100">
            <User className="h-4 w-4" /> Profissional
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2 text-zinc-400 data-[state=active]:text-zinc-100">
            <Share2 className="h-4 w-4" /> Integração
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: DADOS DA CLÍNICA */}
        <TabsContent value="organizacao" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Dados Institucionais</CardTitle>
              <CardDescription className="text-zinc-400">
                Informações exibidas em documentos e cabeçalhos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-zinc-300">Nome da Clínica</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={organization?.name || ''} 
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  placeholder="Ex: Consultório Dr. João Silva"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="document" className="text-zinc-300">CPF ou CNPJ</Label>
                  <Input id="document" name="document" defaultValue={organization?.document || ''} className="bg-zinc-950 border-zinc-800" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-zinc-300">Telefone de Contato</Label>
                  <Input id="phone" name="phone" defaultValue={organization?.phone || ''} className="bg-zinc-950 border-zinc-800" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-zinc-300">Email Comercial</Label>
                <Input id="email" name="email" type="email" defaultValue={organization?.email || ''} className="bg-zinc-950 border-zinc-800" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address" className="text-zinc-300">Endereço Completo</Label>
                <Textarea id="address" name="address" defaultValue={organization?.address || ''} className="bg-zinc-950 border-zinc-800 min-h-[80px]" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: DADOS DO PROFISSIONAL */}
        <TabsContent value="profissional" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Configurações do Médico</CardTitle>
              <CardDescription className="text-zinc-400">
                Como você aparecerá nas mensagens para os pacientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name" className="text-zinc-300">Seu Nome Profissional</Label>
                <Input 
                  id="full_name" 
                  name="full_name" 
                  defaultValue={profile?.full_name || ''} 
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  placeholder="Ex: Dr. Horácio Ferreira"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="crm" className="text-zinc-300">Registro Profissional (CRM/CRP)</Label>
                <Input id="crm" name="crm" defaultValue={organization?.crm || ''} className="bg-zinc-950 border-zinc-800" placeholder="Ex: 123456" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: WHATSAPP E API */}
        <TabsContent value="api" className="space-y-4 mt-4">
          {/* Componente Real do WhatsApp */}
          <WhatsappSettings />

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-sm">Parâmetros Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="evolution_url" className="text-zinc-300">URL da Evolution API</Label>
                <Input 
                  id="evolution_url" 
                  name="evolution_url" 
                  defaultValue={organization?.evolution_url || 'http://localhost:8082'} 
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs text-blue-400"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="evolution_apikey" className="text-zinc-300">API Key (Global)</Label>
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
          <div className="mt-6 p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
          <h4 className="text-sm font-medium text-zinc-300 mb-4">Teste de Envio</h4>
          <div className="flex gap-2">
            <Input 
              id="test_phone" 
              placeholder="Seu número (DDD + número)" 
              className="bg-zinc-900 border-zinc-800"
            />
            <Button 
              type="button"
              variant="secondary"
              onClick={async () => {
                const phone = (document.getElementById('test_phone') as HTMLInputElement).value
                if(!phone) return toast.error("Digite um número")
                
                const res = await sendTestMessage(phone)
                if(res.success) toast.success("Mensagem enviada!")
                else toast.error("Erro: " + res.error)
              }}
            >
              Enviar Teste
            </Button>
          </div>
        </div>
        </TabsContent>
      </Tabs>

      {/* Botão Global de Salvamento */}
      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12">
        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
        Salvar Todas as Configurações
      </Button>
    </form>
  )
}