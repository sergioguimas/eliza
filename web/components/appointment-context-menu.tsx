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
import { ReturnPromptDialog } from "./return-prompt-dialog"
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
  const [isReturnOpen, setIsReturnOpen] = useState(false)

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)
    if (result.success) {
      toast.success(`Status alterado para: ${status}`)      
      if (status === 'completed') {
        setIsReturnOpen(true)
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

  const handleReturnConfirm = (days: number | null) => {
    setIsReturnOpen(false)

    const params = new URLSearchParams()
    params.set('action', 'return')
    if (appointment.customer_id) params.set('customerId', appointment.customer_id)
    if (appointment.service_id) params.set('serviceId', appointment.service_id)
    if (appointment.professional_id) params.set('professionalId', appointment.professional_id)
    if (days) params.set('days', days.toString())

    router.push(`/agendamentos?${params.toString()}`)
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
      <ReturnPromptDialog 
        open={isReturnOpen}
        onOpenChange={setIsReturnOpen}
        onConfirm={handleReturnConfirm}
        customerName={appointment.customers?.name}
      />
    </>
  )
}