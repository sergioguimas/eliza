'use client'

import { useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateSettings } from "@/app/actions/update-settings"
import { WhatsappSettings } from "./whatsapp-settings" 
import { toast } from "sonner"
import { Loader2, Save, Building2, User, MessageCircle } from "lucide-react"

export function SettingsForm({ profile, organization }: any) {
  const [isPending, startTransition] = useTransition()

  // Handler para salvar APENAS Organização
  async function handleSaveOrg(formData: FormData) {
    startTransition(async () => {
      if (organization?.id) formData.append('org_id', organization.id)
      const result = await updateSettings(formData)
      if (result?.error) toast.error(result.error)
      else toast.success("Dados da clínica atualizados!")
    })
  }

  // Handler para salvar APENAS Perfil
  async function handleSaveProfile(formData: FormData) {
    startTransition(async () => {
      const result = await updateSettings(formData)
      if (result?.error) toast.error(result.error)
      else toast.success("Seu perfil foi atualizado!")
    })
  }

  return (
    <Tabs defaultValue="clinica" className="w-full space-y-6">
      <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50">
        <TabsTrigger value="clinica" className="py-2 gap-2">
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">Clínica</span>
        </TabsTrigger>
        <TabsTrigger value="profile" className="py-2 gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Perfil</span>
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="py-2 gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Conexão</span>
        </TabsTrigger>
      </TabsList>

      {/* SUB-ABA 1: CLÍNICA */}
      <TabsContent value="clinica">
        <form action={handleSaveOrg}>
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Informações visíveis para seus clientes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Clínica</Label>
                  <Input name="name" defaultValue={organization?.name || ''} placeholder="Ex: Clínica Saúde Vida" />
                </div>
                <div className="space-y-2">
                  <Label>CPF ou CNPJ</Label>
                  <Input name="document" defaultValue={organization?.document || ''} placeholder="00.000.000/0000-00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone / WhatsApp</Label>
                  <Input name="phone" defaultValue={organization?.phone || ''} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Email de Contato</Label>
                  <Input name="email" defaultValue={organization?.email || ''} placeholder="contato@clinica.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Textarea name="address" defaultValue={organization?.address || ''} rows={2} placeholder="Endereço completo" />
              </div>
            </CardContent>
            <div className="flex justify-end p-6 pt-0 border-t mt-4 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Clínica
              </Button>
            </div>
          </Card>
        </form>
      </TabsContent>

      {/* SUB-ABA 2: PERFIL */}
      <TabsContent value="profile">
        <form action={handleSaveProfile}>
          <input type="hidden" name="org_id" value={organization.id} />
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Seu Perfil</CardTitle>
              <CardDescription>Dados do profissional responsável.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input name="full_name" defaultValue={profile?.full_name || ''} />
              </div>
              <div className="space-y-2">
                <Label>Registro (CRM/CRP/OAB)</Label>
                <Input name="crm" defaultValue={profile?.crm || ''} placeholder="Ex: 12345-SP" />
              </div>
            </CardContent>
            <div className="flex justify-end p-6 pt-0 border-t mt-4 pt-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Perfil
              </Button>
            </div>
          </Card>
        </form>
      </TabsContent>

      {/* SUB-ABA 3: WHATSAPP */}
      <TabsContent value="whatsapp">
         <WhatsappSettings organizationId={organization.id} />
      </TabsContent>

    </Tabs>
  )
}