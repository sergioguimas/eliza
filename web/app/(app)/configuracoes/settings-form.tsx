'use client'

import { useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateSettings } from "@/app/actions/update-settings"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

export function SettingsForm({ profile, organization }: any) {
  const [isPending, startTransition] = useTransition()

  // Handler unificado com tratamento de erro
  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      // Garante que o ID da organização vá junto
      if (organization?.id) formData.append('org_id', organization.id)
      
      const result = await updateSettings(formData)
      
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Dados atualizados com sucesso!")
      }
    })
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="organization" className="w-full">
        <TabsContent value="organization">
          <form action={handleSubmit}>
            <input type="hidden" name="form_type" value="organization" />
            
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle>Dados da Clínica</CardTitle>
                <CardDescription>Informações visíveis nos agendamentos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Clínica</Label>
                  <Input name="name" defaultValue={organization?.name || ''} placeholder="Ex: Clínica Saúde" />
                </div>
                <div className="space-y-2">
                  <Label>Identificador (Slug)</Label>
                  <Input name="slug" defaultValue={organization?.slug || ''} disabled className="bg-muted" />
                  <p className="text-[0.8rem] text-muted-foreground">O identificador é usado na URL e na conexão do WhatsApp.</p>
                </div>
              </CardContent>
              <div className="flex justify-end p-6 pt-5 border-t mt-4">
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Clínica
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}