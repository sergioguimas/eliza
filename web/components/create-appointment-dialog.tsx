'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarPlus, Loader2 } from "lucide-react"
import { createAppointment } from "@/app/actions/create-appointment"
import { toast } from "sonner"

// DEFINIÇÃO DE TIPOS CORRIGIDA
type Props = {
  customers: { id: string; name: string }[]
  services: { id: string; title: string }[] 
  staff: { id: string; full_name: string }[] // Recebe staff
  organization_id: string
}

export function CreateAppointmentDialog({ customers, services, staff, organization_id }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const formData = new FormData(event.currentTarget)
    formData.append('organization_id', organization_id)

    const result = await createAppointment(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento criado!")
      setOpen(false)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <CalendarPlus className="mr-2 h-4 w-4" /> Novo Agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2">
            <Label>Paciente</Label>
            <Select name="customer_id" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Profissional</Label>
            <Select name="staff_id">
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o médico (Opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {staff?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || 'Sem nome'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Procedimento</Label>
            <Select name="service_id" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o procedimento" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data e Hora</Label>
            <Input 
              name="start_time" 
              type="datetime-local" 
              required 
              className="bg-zinc-950 border-zinc-800 block" 
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Agendamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}