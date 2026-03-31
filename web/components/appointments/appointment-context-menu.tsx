'use client'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu"
import {
  Check,
  UserCheck,
  CheckCircle2,
  Ban,
  QrCode,
  CreditCard,
  Banknote,
} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment } from "@/app/actions/delete-appointment"
import { useRouter } from "next/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import { useKeckleon } from "@/providers/keckleon-provider"

interface AppointmentContextMenuProps {
  children: React.ReactNode
  appointment: any
  onStatusChange?: (appointment: any, newStatus: string) => void
}

export function AppointmentContextMenu({
  children,
  appointment,
  onStatusChange,
}: AppointmentContextMenuProps) {
  const router = useRouter()
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const agendamentoSingular = entities.agendamento || "Agendamento"

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)

    if (result.success) {
      if (onStatusChange) {
        onStatusChange(appointment, status)
      }

      if (status === "completed") {
        const targetUrl = `/clientes/${appointment.customer_id}?return_check=${appointment.id}`

        toast.success(
          messages.appointment_completed_redirect ||
            "Atendimento finalizado! Redirecionando..."
        )

        router.push(targetUrl)
        router.refresh()
      } else {
        toast.success(
          messages.status_updated || `Status alterado para: ${status}`
        )
        router.refresh()
      }
    } else {
      toast.error(messages.error_update_status || "Erro ao atualizar status")
    }
  }

  async function handleCancel() {
    toast.promise(cancelAppointment(appointment.id), {
      loading: messages.canceling || "Cancelando...",
      success: () => {
        router.refresh()
        return messages.canceled_success || "Agendamento cancelado!"
      },
      error: messages.cancel_error || "Erro ao cancelar",
    })
  }

  async function handlePayment(method: string) {
    const result = await updateAppointmentPayment(appointment.id, method)

    if (result.success) {
      toast.success(messages.payment_success || "Pagamento confirmado!")
      router.refresh()
    } else {
      toast.error(messages.payment_error || "Erro ao processar pagamento")
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuLabel>
          {actions.quick_actions || "Ações rápidas"}
        </ContextMenuLabel>
        <ContextMenuSeparator />

        {appointment.status === "canceled" ? (
          <ContextMenuItem disabled>
            <Ban className="mr-2 h-4 w-4 text-red-500" />
            <span>{messages.canceled || "Cancelado"}</span>
          </ContextMenuItem>
        ) : appointment.status === "completed" &&
          appointment.payment_status !== "paid" ? (
          <>
            <ContextMenuLabel className="text-xs text-muted-foreground">
              {actions.confirm_payment || "Confirmar pagamento"}
            </ContextMenuLabel>

            <ContextMenuItem onClick={() => handlePayment("pix")}>
              <QrCode className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Pix</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handlePayment("cartao_credito")}>
              <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
              <span>{actions.credit_card || "Cartão de crédito"}</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handlePayment("cartao_debito")}>
              <CreditCard className="mr-2 h-4 w-4 text-indigo-500" />
              <span>{actions.debit_card || "Cartão de débito"}</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handlePayment("dinheiro")}>
              <Banknote className="mr-2 h-4 w-4 text-amber-500" />
              <span>{actions.cash || "Dinheiro"}</span>
            </ContextMenuItem>
          </>
        ) : appointment.payment_status === "paid" ? (
          <ContextMenuItem disabled>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>{messages.payment_done || "Pagamento confirmado"}</span>
          </ContextMenuItem>
        ) : (
          <>
            <ContextMenuItem onClick={() => handleStatusChange("confirmed")}>
              <Check className="mr-2 h-4 w-4 text-blue-500" />
              <span>{actions.confirm || "Confirmar"}</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleStatusChange("arrived")}>
              <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
              <span>{actions.arrived || "Chegada confirmada"}</span>
            </ContextMenuItem>

            <ContextMenuItem onClick={() => handleStatusChange("completed")}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              <span>{actions.complete || "Finalizar"}</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleCancel} className="text-red-600">
              <Ban className="mr-2 h-4 w-4" />
              <span>
                {actions.cancel || `Cancelar ${agendamentoSingular.toLowerCase()}`}
              </span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}