'use client'

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cancelAppointment } from "@/app/actions/cancel-appointment" // Verifique o caminho
import { toast } from "sonner"
import { Loader2, AlertTriangle } from "lucide-react"

interface CancelAppointmentDialogProps {
  appointment: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CancelAppointmentDialog({ 
  appointment, 
  open, 
  onOpenChange,
  onSuccess 
}: CancelAppointmentDialogProps) {
  
  const [isLoading, setIsLoading] = useState(false)

  async function handleCancel() {
    setIsLoading(true)
    const result = await cancelAppointment(appointment.id) // Assume que a action aceita string
    
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento cancelado com sucesso.")
      onOpenChange(false)
      if (onSuccess) onSuccess()
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mx-auto bg-yellow-100 p-3 rounded-full w-fit mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <DialogTitle className="text-center">Cancelar Agendamento?</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Você está prestes a cancelar o agendamento de <br/>
            <strong className="text-foreground">{appointment?.customers?.name}</strong> 
            <br/> com <br/>
            <strong className="text-foreground">{appointment?.profiles?.full_name || "Profissional"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground text-center">
            Esta ação removerá o horário da agenda e notificará o paciente (se configurado).
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Manter Agendamento
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}