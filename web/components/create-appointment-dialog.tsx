'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { createAppointment } from "@/app/actions/create-appointment"
import { toast } from "sonner"
import { CalendarPlus } from "lucide-react"

// Tipos para os dados que vêm do banco
type Props = {
  customers: { id: string; name: string }[]
  services: { id: string; title: string; price: number | null }[]
}

export function CreateAppointmentDialog({ customers, services }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const result = await createAppointment(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento realizado!")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <CalendarPlus className="h-4 w-4" />
          Novo Agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agendar Consulta</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Selecione o paciente, o procedimento e o horário.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Seleção de Paciente */}
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <Select name="customerId" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o paciente..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Procedimento */}
          <div className="grid gap-2">
            <Label>Procedimento</Label>
            <Select name="serviceId" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione o procedimento..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                        {s.title} - R$ {s.price ? s.price.toFixed(2) : '0.00'}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data e Hora */}
          <div className="grid gap-2">
            <Label htmlFor="startTime">Data e Hora</Label>
            {/* Input nativo é o mais fácil para começar */}
            <Input 
              id="startTime" 
              name="startTime" 
              type="datetime-local" 
              required 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 block" // 'block' ajuda no layout do ícone de calendário
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full">
              {loading ? "Agendando..." : "Confirmar Agendamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}