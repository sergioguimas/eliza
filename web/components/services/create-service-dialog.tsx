'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Pencil, Palette } from "lucide-react"
import { upsertService } from "@/app/actions/create-service"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

const COLORS = [
  { name: "Azul", value: "#3b82f6" },
  { name: "Verde", value: "#10b981" },
  { name: "Roxo", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Laranja", value: "#f59e0b" },
  { name: "Vermelho", value: "#ef4444" },
]

type CreateServiceDialogProps = {
  organization_id: string
  serviceToEdit?: any
  triggerLabel?: string
}

export function CreateServiceDialog({
  organization_id,
  serviceToEdit,
  triggerLabel,
}: CreateServiceDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(
    serviceToEdit?.color || COLORS[0].value
  )

  const { dict } = useKeckleon()
  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}
  const fields = dict.fields || {}

  const servico = entities.servico || "Serviço"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    formData.append("color", selectedColor)

    if (serviceToEdit) {
      formData.append("id", serviceToEdit.id)
    }

    const result = await upsertService(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(
        serviceToEdit
          ? messages.updated_success || `${servico} atualizado com sucesso.`
          : messages.created_success || `${servico} criado com sucesso!`
      )
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {serviceToEdit ? (
          <Button variant="outline" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {triggerLabel || actions.create_servico || `Novo ${servico}`}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="border-border bg-background text-foreground shadow-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {serviceToEdit
              ? `${actions.edit || "Editar"} ${servico}`
              : actions.create_servico || `Novo ${servico}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="organization_id" value={organization_id} />

          {serviceToEdit && (
            <input type="hidden" name="id" value={serviceToEdit.id} />
          )}

          <div className="space-y-2">
            <Label htmlFor="service-name" className="text-foreground">
              {fields.name || "Nome"}
            </Label>
            <Input
              id="service-name"
              name="name"
              defaultValue={serviceToEdit?.title || serviceToEdit?.name}
              required
              className="border-input bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-duration" className="text-foreground">
                {messages.duration_minutes || "Duração (min)"}
              </Label>
              <Input
                id="service-duration"
                name="duration"
                type="number"
                defaultValue={serviceToEdit?.duration_minutes}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-price" className="text-foreground">
                {fields.amount || "Preço"} (R$)
              </Label>
              <Input
                id="service-price"
                name="price"
                type="number"
                step="0.01"
                defaultValue={serviceToEdit?.price}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <Label className="mb-3 flex items-center gap-2 text-foreground">
              <Palette className="h-4 w-4 text-muted-foreground" />
              {messages.service_color_label || "Cor na agenda"}
            </Label>

            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  title={c.name}
                  aria-label={`Selecionar cor ${c.name}`}
                  className={`h-8 w-8 rounded-full border-2 ring-offset-background transition-all ${
                    selectedColor === c.value
                      ? "scale-110 border-foreground ring-2 ring-ring ring-offset-2"
                      : "border-border hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">
            {actions.save || "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}