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
import { BRAND_PALETTES } from "@/lib/brand-palette"

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

            <Card>
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

                {/* Paleta: troca só a cor (painel e página de agendamento); vazio = cor padrão do nicho. */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium leading-none">Cor do sistema</legend>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Vale para o painel e para a página de agendamento dos seus clientes.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[{ id: "", label: "Padrão", swatch: "hsl(var(--brand-primary))" }, ...BRAND_PALETTES].map((p) => (
                      <label
                        key={p.id || "padrao"}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                      >
                        <input
                          type="radio"
                          name="brand_palette"
                          value={p.id}
                          defaultChecked={(organization?.brand_palette ?? "") === p.id}
                          className="sr-only"
                        />
                        {/* a amostra do "Padrão" usa a classe do nicho para mostrar a cor dele mesmo com outra paleta ativa */}
                        <span aria-hidden className={`h-4 w-4 rounded-full border ${p.id ? "" : `theme-${meta?.id ?? "generico"}`}`} style={{ background: p.swatch }} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
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