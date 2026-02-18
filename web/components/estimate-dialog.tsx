'use client'

import { useState, useMemo } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Plus, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import { createEstimate } from "@/app/actions/create-estimate"
import { addDays, format } from "date-fns" // Certifique-se de ter date-fns

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EstimateModalProps {
  isOpen: boolean
  onClose: () => void
  customerId: string
  organizationId: string
  professionals: any[]
  services: any[]
}

export function EstimateModal({ isOpen, onClose, customerId, organizationId, professionals, services }: EstimateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  console.log("Profissionais disponíveis:", professionals)
  console.log("Serviços disponíveis:", services)

  const { register, control, handleSubmit, watch, reset, setValue } = useForm({
    defaultValues: {
      professional_id: "",
      validity_days: "15",
      notes: "",
      items: [{ service_id: "", description: "", price: 0, quantity: 1, duration_minutes: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  // Cálculo do Total
  const watchItems = watch("items")
  const total = useMemo(() => {
    return watchItems.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0)
  }, [watchItems])

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    
    // Calcula a data final baseada nos dias selecionados
    const expirationDate = format(addDays(new Date(), parseInt(data.validity_days)), 'yyyy-MM-dd')

    const formData = new FormData()
    formData.append("organization_id", organizationId)
    formData.append("customer_id", customerId)
    formData.append("professional_id", data.professional_id)
    formData.append("notes", data.notes)
    formData.append("expiration_date", expirationDate)
    formData.append("items_json", JSON.stringify(data.items))

    const result = await createEstimate(formData)

    if (result.success) {
      toast.success("Orçamento gerado!")
      reset()
      onClose()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setIsSubmitting(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Orçamento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profissional</Label>
              <select 
                {...register("professional_id")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione o profissional...</option>
                {professionals?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Validade (Dias)</Label>
              <select 
                {...register("validity_days")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="5">5 dias</option>
                <option value="10">10 dias</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Procedimentos Selecionados</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ service_id: "", description: "", price: 0, quantity: 1, duration_minutes: 0 })}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Procedimento
              </Button>
            </div>

            {fields.map((field, index) => (
                <div key={field.id} className="flex gap-5 items-end p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex flex-col gap-2 w-50">
                        <Label>Serviço</Label>
                        <select 
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        onChange={(e) => {
                        const selectedService = services.find(s => s.id === e.target.value)
                        if (selectedService) {
                            setValue(`items.${index}.description`, selectedService.title)
                            setValue(`items.${index}.price`, selectedService.price)
                            setValue(`items.${index}.service_id`, selectedService.id)
                            setValue(`items.${index}.duration_minutes`, selectedService.duration_minutes || 0)
                            setValue(`items.${index}.quantity`, 1)
                        }}}>
                            <option value="">Selecione um serviço...</option>
                            {services?.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                            ))}
                        </select>
                        <div className="mt-2">
                            <Label>Valor (R$)</Label>
                            <Input type="number" step="0.01" {...register(`items.${index}.price` as const)} />
                        </div>
                                           
                    </div>
                    <div className="flex flex-col gap-2 w-30">
                        <div>
                            <Label>Quantidade</Label>
                            <Input type="number" {...register(`items.${index}.quantity` as const)} />
                        </div>
                        <div className="mt-2">
                            <Label>Duração (min)</Label>
                            <Input type="number" {...register(`items.${index}.duration_minutes` as const)} />
                        </div> 
                    </div>
                    <div className="flex items-end">
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(index)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    </div>
                </div>
            ))}
          </div>

          <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex justify-between items-center">
            <span className="font-medium">Total Estimado</span>
            <span className="text-2xl font-bold text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
            </span>
          </div>

          <Textarea {...register("notes")} placeholder="Condições de pagamento ou observações clínicas..." />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[150px]">
              {isSubmitting ? "Gravando..." : "Gerar Orçamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}