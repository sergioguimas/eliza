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
  QrCode, 
  CreditCard, 
  Banknote, 
  MoreHorizontal as MoreIcon
} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment, deleteAppointment } from "@/app/actions/delete-appointment"
import { useState } from "react"
import { useRouter } from "next/dist/client/components/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import { DropdownMenuItem } from "./ui/dropdown-menu"

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

  async function handlePayment(method: string) {
    const result = await updateAppointmentPayment(appointment.id, method)
    if (result.success) {
      toast.success(`Pagamento em ${method} confirmado!`)
      router.refresh()
    } else {
      toast.error("Erro ao processar pagamento")
    }
  }

  

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Ações do Agendamento</ContextMenuLabel>
        <ContextMenuSeparator />

        {/* REGRA: Se concluído e NÃO pago, mostra opções de pagamento */}
        {appointment.status === 'completed' && appointment.payment_status !== 'paid' ? (
          <>
            <ContextMenuLabel className="text-xs text-muted-foreground">Confirmar Recebimento</ContextMenuLabel>
            <ContextMenuItem onClick={() => handlePayment('pix')}>
              <QrCode className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Pix</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePayment('cartao_credito')}>
              <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
              <span>Cartão de Crédito</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePayment('cartao_debito')}>
              <CreditCard className="mr-2 h-4 w-4 text-indigo-500" />
              <span>Cartão de Débito</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handlePayment('dinheiro')}>
              <Banknote className="mr-2 h-4 w-4 text-amber-500" />
              <span>Dinheiro</span>
            </ContextMenuItem>
          </>
        ) : appointment.payment_status === 'paid' ? (
          // Se já estiver pago, mostra apenas o status
          <ContextMenuItem disabled>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>Pagamento Confirmado</span>
          </ContextMenuItem>
        ) : (
          // Fluxo normal para qualquer outro status (Pendente, Confirmado, Chegou)
          <>
            <ContextMenuItem onClick={() => handleStatusChange('confirmed')}>
              <Check className="mr-2 h-4 w-4 text-blue-500" />
              <span>Confirmar</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleStatusChange('arrived')}>
              <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
              <span>Chegou (Recepção)</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleStatusChange('completed')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              <span>Finalizar Atendimento</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleCancel} className="text-red-600">
              <Ban className="mr-2 h-4 w-4" />
              <span>Cancelar Agendamento</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}