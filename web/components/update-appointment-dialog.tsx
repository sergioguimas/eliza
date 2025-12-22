'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateAppointment } from "@/app/actions/update-appointment"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"

interface EditAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: any
  customers: { id: string; name: string }[]
  services: { id: string; title: string; price: number | null }[]
}

export function EditAppointmentDialog({ 
  open, 
  onOpenChange, 
  appointment, 
  customers, 
  services 
}: EditAppointmentDialogProps) {
  const [loading, setLoading] = useState(false)

  // Extrair data e hora do ISO string do agendamento
  const defaultDate = appointment?.start_time ? format(parseISO(appointment.start_time), 'yyyy-MM-dd') : ''
  const defaultTime = appointment?.start_time ? format(parseISO(appointment.start_time), 'HH:mm') : ''

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    // Adiciona o ID que não está no form visível
    formData.append('id', appointment.id) 

    const result = await updateAppointment(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento atualizado!")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Altere os dados do atendimento abaixo.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label htmlFor="customer" className="text-zinc-300">Paciente</Label>
            <Select name="customer_id" defaultValue={appointment.customer_id || appointment.customers?.id}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="service" className="text-zinc-300">Procedimento</Label>
            <Select name="service_id" defaultValue={appointment.service_id || appointment.services?.id}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.title} - R$ {service.price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date" className="text-zinc-300">Data</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time" className="text-zinc-300">Hora</Label>
              <Input
                id="time"
                name="time"
                type="time"
                defaultValue={defaultTime}
                className="bg-zinc-950 border-zinc-800 text-zinc-100"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}