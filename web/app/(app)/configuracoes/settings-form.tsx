'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { updateSettings } from "@/app/actions/update-settings"
import { WhatsappSettings } from "./whatsapp-settings"
import { toast } from "sonner"
import { Loader2, Save, Building2, User, Share2 } from "lucide-react"

interface SettingsFormProps {
  profile: any
  whatsappStatus?: string | null
}

export function SettingsForm({ profile, whatsappStatus }: SettingsFormProps) {
  const [loading, setLoading] = useState(false)
  
  // Estado inicial unificado para não perder dados ao trocar de aba
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    full_name: '',
    crm: '',
    evolution_url: 'http://localhost:8082',
    evolution_apikey: 'medagenda123'
  })

  // Carrega os dados existentes quando o componente monta
  useEffect(() => {
    const org = profile?.organizations
    if (org || profile) {
      setFormData({
        name: org?.name || '',
        document: org?.document || '',
        phone: org?.phone || '',
        email: org?.email || '',
        address: org?.address || '',
        full_name: profile?.full_name || '', // Nome do médico vem do profile
        crm: org?.crm || '', // CRM pode estar na organização ou metadata
        evolution_url: org?.evolution_api_url || org?.evolution_url || 'http://localhost:8082',
        evolution_apikey: org?.evolution_api_key || org?.evolution_apikey || 'medagenda123'
      })
    }
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    // Constrói o FormData manualmente a partir do Estado (State)
    // Isso garante que mesmo campos de abas ocultas sejam enviados
    const dataToSend = new FormData()
    
    // IDs obrigatórios
    dataToSend.append('user_id', profile?.id)
    dataToSend.append('org_id', profile?.organization_id || '')
    
    // Campos do formulário
    Object.entries(formData).forEach(([key, value]) => {
      dataToSend.append(key, value)
    })

    const result = await updateSettings(dataToSend)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Configurações salvas com sucesso!")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
                  value={formData.name}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="document" className="text-zinc-300">CPF ou CNPJ</Label>
                  <Input 
                    id="document" 
                    name="document" 
                    value={formData.document}
                    onChange={handleChange}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-zinc-300">Telefone de Contato</Label>
                  <Input 
                    id="phone" 
                    name="phone" 
                    value={formData.phone}
                    onChange={handleChange}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100" 
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-zinc-300">Email Comercial</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  value={formData.email}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address" className="text-zinc-300">Endereço Completo</Label>
                <Textarea 
                  id="address" 
                  name="address" 
                  value={formData.address}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 min-h-[80px]" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: DADOS DO PROFISSIONAL */}
        <TabsContent value="profissional" className="space-y-4 mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Configurações do Médico</CardTitle>
              <CardDescription className="text-zinc-400">Como você aparecerá nas mensagens para os pacientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name" className="text-zinc-300">Seu Nome Profissional</Label>
                <Input 
                  id="full_name" 
                  name="full_name" 
                  value={formData.full_name}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="crm" className="text-zinc-300">Registro Profissional (CRM/CRP)</Label>
                <Input 
                  id="crm" 
                  name="crm" 
                  value={formData.crm}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: WHATSAPP E API */}
        <TabsContent value="api" className="space-y-4 mt-4">
          <WhatsappSettings initialStatus={whatsappStatus} />

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
                  value={formData.evolution_url}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs text-blue-400"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="evolution_apikey" className="text-zinc-300">API Key (Global)</Label>
                <Input 
                  id="evolution_apikey" 
                  name="evolution_apikey" 
                  type="password"
                  value={formData.evolution_apikey}
                  onChange={handleChange}
                  className="bg-zinc-950 border-zinc-800 font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12">
        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
        Salvar Todas as Configurações
      </Button>
    </form>
  )
}