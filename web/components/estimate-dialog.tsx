'use client'

import { useMemo, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { FileText, Plus, Trash2 } from "lucide-react"
import { addDays, format } from "date-fns"
import { toast } from "sonner"

import { createEstimate } from "@/app/actions/create-estimate"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type ProfessionalOption = {
  id: string
  name: string | null
}

type ServiceOption = {
  id: string
  title: string | null
  price: number | string | null
  duration_minutes?: number | null
}

type EstimateItemForm = {
  service_id: string
  description: string
  price: number
  quantity: number
  duration_minutes: number
}

type EstimateFormValues = {
  professional_id: string
  validity_days: string
  notes: string
  items: EstimateItemForm[]
}

interface EstimateModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  organizationId: string
  professionals: ProfessionalOption[]
  services: ServiceOption[]
}

const emptyItem: EstimateItemForm = {
  service_id: "",
  description: "",
  price: 0,
  quantity: 1,
  duration_minutes: 0,
}

export function EstimateModal({
  isOpen,
  onClose,
  customerId,
  organizationId,
  professionals,
  services,
}: EstimateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
  } = useForm<EstimateFormValues>({
    defaultValues: {
      professional_id: "",
      validity_days: "15",
      notes: "",
      items: [{ ...emptyItem }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  })

  const watchedItems = useWatch({
    control,
    name: "items",
  })

  const total = useMemo(() => {
    return (watchedItems ?? []).reduce((acc, item) => {
      const price = Number(item?.price ?? 0)
      const quantity = Number(item?.quantity ?? 0)
      return acc + price * quantity
    }, 0)
  }, [watchedItems])

  const handleServiceChange = (index: number, serviceId: string) => {
    const selectedService = services.find((service) => service.id === serviceId)

    setValue(`items.${index}.service_id`, serviceId, { shouldDirty: true, shouldTouch: true })

    if (!selectedService) {
      setValue(`items.${index}.description`, "", { shouldDirty: true })
      setValue(`items.${index}.price`, 0, { shouldDirty: true })
      setValue(`items.${index}.duration_minutes`, 0, { shouldDirty: true })
      return
    }

    setValue(`items.${index}.description`, selectedService.title ?? "", { shouldDirty: true })
    setValue(`items.${index}.price`, Number(selectedService.price ?? 0), { shouldDirty: true })
    setValue(`items.${index}.duration_minutes`, Number(selectedService.duration_minutes ?? 0), { shouldDirty: true })
    setValue(`items.${index}.quantity`, Number(watchedItems?.[index]?.quantity ?? 1) || 1, { shouldDirty: true })
  }

  const onSubmit = async (data: EstimateFormValues) => {
    try {
      setIsSubmitting(true)

      const expirationDate = format(
        addDays(new Date(), parseInt(data.validity_days, 10)),
        "yyyy-MM-dd"
      )

      const sanitizedItems = data.items.map((item) => ({
        ...item,
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        duration_minutes: Number(item.duration_minutes ?? 0),
      }))

      const formData = new FormData()
      formData.append("organization_id", organizationId)
      formData.append("customer_id", customerId)
      formData.append("professional_id", data.professional_id)
      formData.append("notes", data.notes ?? "")
      formData.append("expiration_date", expirationDate)
      formData.append("items_json", JSON.stringify(sanitizedItems))

      const result = await createEstimate(formData)

      if (result.success) {
        toast.success("Orçamento gerado!")
        reset({
          professional_id: "",
          validity_days: "15",
          notes: "",
          items: [{ ...emptyItem }],
        })
        onClose()
        return
      }

      toast.error(result.error || "Erro ao salvar")
    } catch {
      toast.error("Erro inesperado ao gerar orçamento")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Orçamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Controller
                control={control}
                name="professional_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o profissional..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals?.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name ?? "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Validade (Dias)</Label>
              <Controller
                control={control}
                name="validity_days"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a validade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 dias</SelectItem>
                      <SelectItem value="10">10 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-base font-semibold">Procedimentos Selecionados</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...emptyItem })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Procedimento
              </Button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex justify-around items-start gap-4 rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900/50 md:flex-row md:items-end"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                  <Label className="mb-2">Serviço</Label>
                  <Controller
                    control={control}
                    name={`items.${index}.service_id`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value)
                          handleServiceChange(index, value)
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um serviço..." />
                        </SelectTrigger>
                        <SelectContent>
                          {services?.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.title ?? "Serviço sem nome"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  </div>

                  <div>
                    <Label className="mb-2">Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`items.${index}.price`, { valueAsNumber: true })}
                    />
                  </div>
                  <div>
                    <Label className="mb-2">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>

                  <div>
                    <Label className="mb-2">Duração (min)</Label>
                    <Input
                      type="number"
                      min="0"
                      {...register(`items.${index}.duration_minutes`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
                  <div>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
            ))}
            
          </div>

          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-4">
            <span className="font-medium">Total Estimado</span>
            <span className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(total)}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              {...register("notes")}
              placeholder="Condições de pagamento ou observações clínicas..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
              {isSubmitting ? "Gravando..." : "Gerar Orçamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}