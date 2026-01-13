'use client'

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateAppointment } from "@/app/actions/update-appointment" // Verifique se esse caminho está certo
import { toast } from "sonner"
import { Loader2, CalendarIcon, Clock, User, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"

interface UpdateAppointmentDialogProps {
  appointment: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  professionals?: any[] // Lista de médicos (nova prop)
  services?: any[]      // Lista de serviços (para poder trocar também)
  currentUser?: any     // Para saber permissões
}

export function UpdateAppointmentDialog({ 
  appointment, 
  open, 
  onOpenChange,
  professionals = [],
  services = [],
  currentUser
}: UpdateAppointmentDialogProps) {
  
  const [isLoading, setIsLoading] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)

  // States do formulário
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [professionalId, setProfessionalId] = useState("")

  // Preenche o formulário quando o agendamento muda
  useEffect(() => {
    if (appointment && open) {
      // Data e Hora
      if (appointment.start_time) {
        const d = new Date(appointment.start_time)
        setDate(d.toISOString().split('T')[0])
        setTime(d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      }
      
      setNotes(appointment.notes || "")
      setServiceId(appointment.service_id || "")
      setProfessionalId(appointment.professional_id || "")
    }
  }, [appointment, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!appointment) return

    setIsLoading(true)

    const formData = new FormData()
    formData.append('appointment_id', appointment.id)
    formData.append('date', date)
    formData.append('time', time)
    formData.append('notes', notes)
    
    // Campos opcionais/alteráveis
    if (serviceId) formData.append('service_id', serviceId)
    if (professionalId) formData.append('professional_id', professionalId)

    const result = await updateAppointment(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento atualizado!")
      onOpenChange(false)
    }
    
    setIsLoading(false)
  }

  if (!appointment) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Paciente: <span className="font-bold text-foreground">{appointment.customers?.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            
            {/* SELEÇÃO DE PROFISSIONAL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                  <User className="w-3 h-3" />
                  Profissional Responsável
              </Label>
              <Select 
                  value={professionalId} 
                  onValueChange={setProfessionalId}
                  disabled={currentUser?.role === 'professional'} // Médico não deve transferir pacientes (regra opcional)
              >
                  <SelectTrigger className="bg-muted/20">
                      <SelectValue placeholder="Selecione o especialista" />
                  </SelectTrigger>
                  <SelectContent>
                      {professionals.map(prof => (
                          <SelectItem key={prof.id} value={prof.id}>
                              {prof.full_name || prof.email}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>

            {/* SERVIÇO */}
            <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                        {services.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                                {s.title}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* DATA E HORA */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  Data
                </Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Horário
                </Label>
                <Input 
                  type="time" 
                  value={time} 
                  onChange={e => setTime(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="resize-none"
              />
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between w-full gap-2">
              <Button 
                type="button" 
                variant="destructive" 
                size="icon"
                onClick={() => setIsCancelOpen(true)}
                title="Cancelar Agendamento"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Voltar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Alterações
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CANCELAMENTO ANINHADO */}
      <CancelAppointmentDialog 
        appointment={appointment}
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        onSuccess={() => onOpenChange(false)} // Fecha o modal de edição ao cancelar
      />
    </>
  )
}