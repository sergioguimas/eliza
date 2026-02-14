'use client'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu"
import { MoreHorizontal, Check, UserCheck, CheckCircle2, Ban, QrCode, CreditCard, Banknote,} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment, deleteAppointment } from "@/app/actions/delete-appointment"
import { useRouter } from "next/dist/client/components/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"

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
      if (status === 'completed') {
        const targetUrl = `/clientes/${appointment.customer_id}?return_check=${appointment.id}`
        toast.success("Consulta finalizada! Redirecionando para o prontuário...")
        router.push(targetUrl)
        router.refresh()
      } else {
        toast.success(`Status alterado para: ${status}`)
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
        <ContextMenuLabel>Ações rápidas</ContextMenuLabel>
        <ContextMenuSeparator />

        {appointment.status === 'canceled' ? (
          <ContextMenuItem disabled>
            <Ban className="mr-2 h-4 w-4 text-red-500" />
            <span>Agendamento Cancelado</span>
          </ContextMenuItem>
        ) : appointment.status === 'completed' && appointment.payment_status !== 'paid' ? (
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
          <ContextMenuItem disabled>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>Pagamento Confirmado</span>
          </ContextMenuItem>
        ) : (
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