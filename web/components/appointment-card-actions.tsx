'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Check, UserCheck, CheckCircle2, Ban, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment, deleteAppointment } from "@/app/actions/delete-appointment"
import { ReturnPromptDialog } from "@/components/return-prompt-dialog"
import { useState } from "react"
import { useRouter } from "next/dist/client/components/navigation"

export function AppointmentCardActions({ appointment }: { appointment: any }) {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200/50 rounded-full">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
            <Check className="mr-2 h-4 w-4 text-blue-500" />
            <span>Confirmar</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleStatusChange('arrived')}>
            <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
            <span>Chegou (Recepção)</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>Finalizar</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleCancel} className="text-red-600 focus:text-red-600 focus:bg-red-50">
            <Ban className="mr-2 h-4 w-4" />
            <span>Cancelar</span>
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>

      <ReturnPromptDialog 
        open={isReturnOpen}
        onOpenChange={setIsReturnOpen}
        onConfirm={handleReturnConfirm}
        customerName={appointment.customers?.name}
      />
    </>
  )
}