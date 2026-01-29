'use client'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from "@/components/ui/context-menu"
import { 
  Check, 
  UserCheck, 
  CheckCircle2, 
  Ban, 
  Trash2,
  CalendarClock
} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment, deleteAppointment } from "@/app/actions/delete-appointment"
import { useState } from "react"
import { useRouter } from "next/dist/client/components/navigation"

interface AppointmentContextMenuProps {
  children: React.ReactNode
  appointment: any
  onStatusChange?: (appointment: any, newStatus: string) => void 
}
export function AppointmentContextMenu({ 
  children, 
  appointment,
  onStatusChange 
}: AppointmentContextMenuProps) {
  const router = useRouter()

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)
    
    if (result.success) {
      toast.success(`Status alterado para: ${status}`)
      
      if (status === 'completed') {
        const params = new URLSearchParams(window.location.search)
        params.set('return_check', appointment.id)
        
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
      } else {
        router.refresh()
      }
    } else {
      toast.error("Erro ao atualizar status")
    }
  }

  async function handleCancel() {
    toast.promise(cancelAppointment(appointment.id), {
      loading: 'Cancelando...',
      success: () => {
        router.refresh()
        return 'Agendamento cancelado!'
      },
      error: 'Erro ao cancelar'
    })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-56">
          <ContextMenuLabel>Ações Rápidas</ContextMenuLabel>
          <ContextMenuSeparator />

          {/* --- CONFIRMAR --- */}
          <ContextMenuItem onClick={() => handleStatusChange('confirmed')}>
            <Check className="mr-2 h-4 w-4 text-blue-500" />
            <span>Confirmar</span>
          </ContextMenuItem>

          {/* --- CHEGOU --- */}
          <ContextMenuItem onClick={() => handleStatusChange('arrived')}>
            <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
            <span>Chegou (Recepção)</span>
          </ContextMenuItem>

          {/* --- FINALIZAR --- */}
          <ContextMenuItem onClick={() => handleStatusChange('completed')}>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>Finalizar</span>
          </ContextMenuItem>

          {/* --- REAGENDAR --- */}        
          <ContextMenuSeparator />

          {/* --- CANCELAR --- */}
          <ContextMenuItem onClick={handleCancel} className="text-red-600 focus:text-red-600 focus:bg-red-50">
            <Ban className="mr-2 h-4 w-4" />
            <span>Cancelar</span>
          </ContextMenuItem>

        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}