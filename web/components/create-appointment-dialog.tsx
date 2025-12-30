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
import { CalendarPlus, Loader2 } from "lucide-react"

// Tipos atualizados para o novo banco (name ao invés de title)
type Props = {
  customers: { id: string; name: string }[]
  services: { id: string; name: string; price: number | null }[] // <--- CORRIGIDO
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
      toast.success("Agendamento criado com sucesso!")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Novo Agendamento
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Preencha os dados abaixo para marcar um horário.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Cliente */}
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <Select name="customerId" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 focus:ring-blue-900">
                <SelectValue placeholder="Selecione o paciente..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-h-[200px]">
                {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Procedimento */}
          <div className="grid gap-2">
            <Label>Procedimento</Label>
            <Select name="serviceId" required>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 focus:ring-blue-900">
                <SelectValue placeholder="Selecione o procedimento..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                {services?.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                        {/* CORRIGIDO: s.name ao invés de s.title */}
                        {s.name} - {s.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.price) : 'R$ 0,00'}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data e Hora */}
          <div className="grid gap-2">
            <Label htmlFor="startTime">Data e Hora</Label>
            <Input 
              id="startTime" 
              name="startTime" 
              type="datetime-local" 
              required 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-900 block dark:[color-scheme:dark]" 
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full mt-2">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Confirmar Agendamento'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}