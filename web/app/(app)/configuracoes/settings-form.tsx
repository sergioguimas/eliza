'use client'

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Database } from "@/utils/database.types"
import { updateSettings } from "@/app/actions/update-settings"
import { WhatsappSettings } from "./whatsapp-settings"
import { MessagesSettings } from "./message-settings" // <--- Importamos o novo componente
import { toast } from "sonner"
import { Loader2, Save, Building2, User, Share2, MessageSquare } from "lucide-react"

interface SettingsFormProps {
  profile: any
  organization: any // Adicionei para garantir tipagem, mas usamos o profile.organizations
  templates: any[]  // <--- Recebe os templates do banco
}

export function SettingsForm({ profile, organization, templates }: SettingsFormProps) {
  const [loading, setLoading] = useState(false)
  
  // Estado unificado do formulário principal (Perfil + Conexão)
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

  // Carrega os dados quando o componente monta
  useEffect(() => {
    if (profile && profile.organizations) {
      setFormData({
        name: profile.organizations.name || '',
        document: profile.organizations.document || '',
        phone: profile.organizations.phone || '',
        email: profile.organizations.email || '',
        address: profile.organizations.address || '',
        full_name: profile.full_name || '',
        crm: profile.crm || '',
        evolution_url: profile.organizations.evolution_instance || '', // Ajuste conforme seu banco
        evolution_apikey: profile.organizations.evolution_apikey || ''
      })
    }
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault() 
      setLoading(true)

      try {
        const dataToSend = new FormData()

        Object.entries(formData).forEach(([key, value]) => {
          dataToSend.append(key, value || '') 
        })

        await updateSettings(dataToSend)
        
        toast.success("Configurações salvas com sucesso!")
      } catch (error) {
        console.error(error)
        toast.error("Erro ao salvar configurações.")
      } finally {
        setLoading(false)
      }
    }

  return (
    <Tabs defaultValue="profile" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="profile">Perfil</TabsTrigger>
        <TabsTrigger value="connection">Conexão</TabsTrigger>
        <TabsTrigger value="messages">Mensagens</TabsTrigger> {/* <--- Nova Aba */}
      </TabsList>

      {/* --- ABA 1: PERFIL (Seu código original mantido) --- */}
      <TabsContent value="profile">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Dados da Clínica
              </CardTitle>
              <CardDescription>Informações exibidas para seus pacientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Clínica</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">CNPJ / CPF</Label>
                  <Input id="document" name="document" value={formData.document} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" value={formData.email} onChange={handleChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Input id="address" name="address" value={formData.address} onChange={handleChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Dados do Profissional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crm">Registro Profissional (CRM/Outros)</Label>
                  <Input id="crm" name="crm" value={formData.crm} onChange={handleChange} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Alterações de Perfil
          </Button>
        </form>
      </TabsContent>
      
      {/* --- ABA 2: CONEXÃO (Seu código original mantido) --- */}
      <TabsContent value="connection" className="space-y-4">
        {/* Componente do QR Code (Importado) */}
        <WhatsappSettings />

        {/* Formulário de Configuração Técnica */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" /> Parâmetros da API
              </CardTitle>
              <CardDescription>Configuração avançada da Evolution API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evolution_url">URL da Instância</Label>
                <Input 
                  id="evolution_url" 
                  name="evolution_url" 
                  value={formData.evolution_url} 
                  onChange={handleChange} 
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution_apikey">API Key</Label>
                <Input 
                  id="evolution_apikey" 
                  name="evolution_apikey" 
                  type="password"
                  value={formData.evolution_apikey} 
                  onChange={handleChange} 
                  className="font-mono text-xs"
                />
              </div>
              <Button type="submit" disabled={loading} className="mt-4 w-full md:w-auto">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Conexão
              </Button>
            </CardContent>
          </Card>
        </form>
      </TabsContent>

      {/* --- ABA 3: MENSAGENS (NOVA!) --- */}
      <TabsContent value="messages" className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Personalização de Respostas</h2>
        </div>
        
        {/* Aqui entra o componente que criamos no passo anterior */}
        <MessagesSettings templates={templates} />
      </TabsContent>
    </Tabs>
  )
}