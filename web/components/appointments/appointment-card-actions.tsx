'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  MoreHorizontal,
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
import { cn } from "@/lib/utils"

export function AppointmentCardActions({
  appointment,
  compact = false,
}: {
  appointment: any
  /** Cabe num card apertado da agenda — trigger menor, mesmo menu. */
  compact?: boolean
}) {
  const router = useRouter()
  const { dict } = useKeckleon()

  const labels = dict.actions || {}
  const messages = dict.messages || {}

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)

    if (result.success) {
      // Genérico, não específico de demo: barato para todo tenant (ninguém
      // escuta fora do tour) e dá ao tour um sinal de que o status mudou de
      // verdade, em vez de confiar num clique em "Entendi".
      window.dispatchEvent(
        new CustomEvent("eliza:appointment-status-changed", { detail: { status } })
      )

      if (status === 'completed') {
        const targetUrl = `/clientes/${appointment.customer_id}?return_check=${appointment.id}`

        toast.success(
          messages.appointment_completed_redirect ||
          "Atendimento finalizado! Redirecionando..."
        )

        router.push(targetUrl)
        router.refresh()
      } else {
        toast.success(
          messages.status_updated ||
          `Status atualizado para ${status}`
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
      window.dispatchEvent(new CustomEvent("eliza:appointment-paid"))

      toast.success(
        messages.payment_success || `Pagamento confirmado`
      )
      router.refresh()
    } else {
      toast.error(messages.payment_error || "Erro ao processar pagamento")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "p-0 hover:bg-slate-200/50 rounded-full shrink-0",
            compact ? "h-5 w-5" : "h-6 w-6"
          )}
        >
          <MoreHorizontal className={compact ? "h-3.5 w-3.5 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
          <span className="sr-only">
            {labels.open_menu || "Abrir menu"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {appointment.status === 'canceled' ? (
          <DropdownMenuItem disabled>
            <Ban className="mr-2 h-4 w-4 text-red-500" />
            <span>
              {messages.canceled || "Cancelado"}
            </span>
          </DropdownMenuItem>

        ) : appointment.status === 'completed' && appointment.payment_status !== 'paid' ? (
          <>
            <DropdownMenuLabel>
              {labels.confirm_payment || "Confirmar pagamento"}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => handlePayment('pix')}>
              <QrCode className="mr-2 h-4 w-4 text-emerald-500" />
              <span>Pix</span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handlePayment('cartao_credito')}>
              <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
              <span>
                {labels.credit_card || "Cartão de crédito"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handlePayment('cartao_debito')}>
              <CreditCard className="mr-2 h-4 w-4 text-indigo-500" />
              <span>
                {labels.debit_card || "Cartão de débito"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handlePayment('dinheiro')}>
              <Banknote className="mr-2 h-4 w-4 text-amber-500" />
              <span>
                {labels.cash || "Dinheiro"}
              </span>
            </DropdownMenuItem>
          </>
        ) : appointment.payment_status === 'paid' ? (
          <DropdownMenuItem disabled>
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
            <span>
              {messages.payment_done || "Pagamento concluído"}
            </span>
          </DropdownMenuItem>

        ) : (
          <>
            <DropdownMenuLabel>
              {labels.quick_actions || "Ações rápidas"}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
              <Check className="mr-2 h-4 w-4 text-blue-500" />
              <span>
                {labels.confirm || "Confirmar"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleStatusChange('arrived')}>
              <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
              <span>
                {labels.arrived || "Chegada confirmada"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              <span>
                {labels.complete || "Finalizar"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleCancel}
              className="text-red-600"
            >
              <Ban className="mr-2 h-4 w-4" />
              <span>
                {labels.cancel || "Cancelar"}
              </span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}