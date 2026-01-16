'use client'

import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger, 
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from "@/components/ui/context-menu"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment } from "@/app/actions/cancel-appointment" // Importe a nova action
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

export function AppointmentContextMenu({ children, appointment, className }: any) {
  
  async function handleStatusChange(newStatus: string) {
    const result = await updateAppointmentStatus(appointment.id, newStatus)
    if (result.success) {
      toast.success(`Status atualizado!`)
    } else {
      toast.error("Erro ao atualizar status")
    }
  }

  async function handleCancel() {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
      const result = await cancelAppointment(appointment.id)
      if (result.success) {
        toast.success("Agendamento cancelado com sucesso")
      } else {
        toast.error("Erro ao cancelar")
      }
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-background border-border text-zinc-200">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Alterar Status</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-background border-border text-zinc-200">
            {Object.entries(STATUS_CONFIG).map(([key, value]) => (
              <ContextMenuItem 
                key={key} 
                onClick={() => handleStatusChange(key)}
                className="gap-2"
              >
                <value.icon className="h-4 w-4" />
                {value.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator className="bg-zinc-800" />
        
        {/* BOTÃO DE CANCELAR AGORA FUNCIONAL */}
        <ContextMenuItem 
          onClick={handleCancel}
          className="text-red-400 focus:text-red-400 gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Cancelar Agendamento
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}