'use client'

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cancelAppointment } from "@/app/actions/cancel-appointment"
import { toast } from "sonner"
import { Loader2, AlertTriangle } from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

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
  onSuccess,
}: CancelAppointmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const agendamentoSingular = entities.agendamento || "Agendamento"
  const clienteSingular = entities.cliente || dict.label_cliente || "Cliente"
  const profissionalSingular =
    entities.profissional || dict.label_profissional || "Profissional"

  async function handleCancel() {
    setIsLoading(true)

    const result = await cancelAppointment(appointment.id)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(
        messages.canceled_success ||
          `${agendamentoSingular} cancelado com sucesso.`
      )
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

          <DialogTitle className="text-center">
            {actions.cancel || "Cancelar"} {agendamentoSingular.toLowerCase()}?
          </DialogTitle>

          <DialogDescription className="text-center pt-2">
            Você está prestes a cancelar o{" "}
            {agendamentoSingular.toLowerCase()} de <br />
            <strong className="text-foreground">
              {appointment?.customers?.name || clienteSingular}
            </strong>
            <br />
            com <br />
            <strong className="text-foreground">
              {appointment?.profiles?.name ||
                appointment?.professionals?.name ||
                profissionalSingular}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground text-center">
          Esta ação removerá o horário da agenda e poderá notificar o{" "}
          {clienteSingular.toLowerCase()} se essa automação estiver habilitada.
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {actions.keep || `Manter ${agendamentoSingular.toLowerCase()}`}
          </Button>

          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actions.confirm_cancel || "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}