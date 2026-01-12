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
import { useKeckleon } from "@/providers/keckleon-provider"

type Props = {
  customers: { id: string; name: string }[]
  services: { id: string; title: string }[] 
  staff: { id: string; full_name: string }[]
  organization_id: string
}

// CORREÇÃO: Usando 'export function' (Named Export) para casar com o import do CalendarView
export function CreateAppointmentDialog({ customers, services, staff, organization_id }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { dict } = useKeckleon()

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
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <CalendarPlus className="mr-2 h-4 w-4" /> Novo Agendamento
        </Button>
      </DialogTrigger>
      
      <DialogContent className="bg-card border border-border text-card-foreground shadow-xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2">
            <Label>{dict.label_cliente}</Label>
            <Select name="customer_id" required>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder={`Selecione o ${dict.label_cliente}`} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{dict.label_profissional}</Label>
            <Select name="staff_id">
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder={`Selecione o ${dict.label_profissional} (Opcional)`} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
                {staff?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name || 'Sem nome'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{dict.label_servico}</Label>
            <Select name="service_id" required>
              <SelectTrigger className="bg-background border-input">
                <SelectValue placeholder={`Selecione o ${dict.label_servico}`} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border text-popover-foreground">
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
              className="bg-background border-input block" 
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirmar Agendamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}