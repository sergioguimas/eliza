'use client'

import { useTransition } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { updateSettings } from "@/app/actions/update-settings"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

export function SettingsForm({ profile, organization }: any) {
  const [isPending, startTransition] = useTransition()
  const { dict, meta } = useKeckleon()

  const messages = dict.messages || {}
  const actions = dict.actions || {}
  const fields = dict.fields || {}
  const sections = dict.sections || {}

  const orgLabel = messages.organization_label || meta?.sidebarLabel || "Organização"

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (organization?.id) formData.append("org_id", organization.id)

      const result = await updateSettings(formData)

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(
          messages.updated_success || "Dados atualizados com sucesso!"
        )
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
                <CardTitle>
                  {sections.organization_data || `Dados da ${orgLabel}`}
                </CardTitle>
                <CardDescription>
                  {messages.organization_public_info_description ||
                    "Informações visíveis nos agendamentos."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{fields.organization_name || `Nome da ${orgLabel}`}</Label>
                  <Input
                    name="name"
                    defaultValue={organization?.name || ""}
                    placeholder={
                      messages.organization_name_placeholder ||
                      `Ex: ${orgLabel} Exemplo`
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>{fields.slug || "Identificador (Slug)"}</Label>
                  <Input
                    name="slug"
                    defaultValue={organization?.slug || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    {messages.slug_description ||
                      "O identificador é usado na URL e em integrações do sistema."}
                  </p>
                </div>
              </CardContent>

              <div className="flex justify-end p-6 pt-5 border-t mt-4">
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {actions.save_organization || `Salvar ${orgLabel}`}
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}