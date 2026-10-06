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
  UserX,
} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment } from "@/app/actions/cancel-appointment"
import { useRouter } from "next/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import { useKeckleon } from "@/providers/keckleon-provider"
import { cn } from "@/lib/utils"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import {
  acoesDoAgendamento,
  lancarSeErro,
  METODOS_NOS_MENUS,
  rotuloMetodo,
} from "@/components/appointments/acoes-agendamento"

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

  // Única fonte do que mostrar: a máquina de status (ver acoes-agendamento.ts).
  const acoes = acoesDoAgendamento(appointment)
  const temAcao =
    acoes.confirmar || acoes.chegou || acoes.finalizar || acoes.faltou || acoes.pagar || acoes.cancelar

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)

    if (!result.error) {
      // Genérico, não específico de demo: barato para todo tenant (ninguém
      // escuta fora do tour) e dá ao tour um sinal de que o status mudou de
      // verdade, em vez de confiar num clique em "Entendi".
      window.dispatchEvent(
        new CustomEvent("eliza:appointment-status-changed", { detail: { status } })
      )

      if (status === 'arrived') {
        // Evento dedicado, à parte do genérico acima: o passo "chegou" do
        // tour é popover simples (não navega), então precisa de um sinal só
        // dele para saber que a chegada foi de fato confirmada — sem isso, o
        // único jeito de avançar era o botão "Entendi", que some junto com o
        // popover assim que este menu abre (`hidePopoverOnly`). Mesmo padrão
        // de "appointment-created"/"appointment-paid": barato, ninguém
        // escuta fora do tour.
        window.dispatchEvent(new CustomEvent("eliza:appointment-arrived"))
      }

      if (status === 'completed') {
        const targetUrl = `/clientes/${appointment.customer_id}?return_check=${appointment.id}`

        toast.success(
          messages.appointment_completed_redirect ||
          "Atendimento finalizado! Redirecionando..."
        )

        router.push(targetUrl)
      } else {
        toast.success(
          messages.status_updated ||
          `Status atualizado para ${status}`
        )
        router.refresh()
      }
    } else {
      // Mensagem do domínio (ex.: "alterado por outra pessoa"), não a genérica.
      toast.error(result.error || messages.error_update_status || "Erro ao atualizar status")
      // Recusa costuma ser tela desatualizada (outra aba, webhook): recarrega
      // para o card mostrar o status real.
      router.refresh()
    }
  }

  async function handleCancel() {
    // `lancarSeErro`: a action devolve `{ error }` sem lançar; sem isto o toast
    // mostraria sucesso mesmo com a recusa.
    toast.promise(lancarSeErro(cancelAppointment(appointment.id)), {
      loading: messages.canceling || "Cancelando...",
      success: () => {
        router.refresh()
        return messages.canceled_success || "Agendamento cancelado!"
      },
      error: (e: Error) => e.message || messages.cancel_error || "Erro ao cancelar",
    })
  }

  async function handlePayment(method: string) {
    const result = await updateAppointmentPayment(appointment.id, method)

    if (!result.error) {
      window.dispatchEvent(new CustomEvent("eliza:appointment-paid"))

      toast.success(
        messages.payment_success || `Pagamento confirmado`
      )
      router.refresh()
    } else {
      toast.error(result.error || messages.payment_error || "Erro ao processar pagamento")
      // Recusa costuma ser tela desatualizada (outra aba, webhook): recarrega
      // para o card mostrar o status real.
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "p-0 hover:bg-accent rounded-full shrink-0",
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
        {!temAcao ? (
          // Nada a oferecer (finalizado e pago, cancelado, faltou...): em vez de
          // um menu vazio, um item desabilitado diz o porquê.
          <DropdownMenuItem disabled>
            {appointment.payment_status === 'paid' ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : (
              <Ban className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {appointment.payment_status === 'paid'
                ? messages.payment_done || "Pagamento concluído"
                : STATUS_CONFIG[appointment.status]?.label || messages.canceled || "Sem ações"}
            </span>
          </DropdownMenuItem>
        ) : (
          <>
            {(acoes.confirmar || acoes.chegou || acoes.finalizar || acoes.faltou) && (
              <>
                <DropdownMenuLabel>
                  {labels.quick_actions || "Ações rápidas"}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />
              </>
            )}

            {acoes.confirmar && (
              <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
                <Check className="mr-2 h-4 w-4 text-info" />
                <span>
                  {labels.confirm || "Confirmar"}
                </span>
              </DropdownMenuItem>
            )}

            {acoes.chegou && (
              <DropdownMenuItem onClick={() => handleStatusChange('arrived')}>
                <UserCheck className="mr-2 h-4 w-4 text-warning" />
                <span>
                  {labels.arrived || "Chegada confirmada"}
                </span>
              </DropdownMenuItem>
            )}

            {acoes.finalizar && (
              <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                <span>
                  {labels.complete || "Finalizar"}
                </span>
              </DropdownMenuItem>
            )}

            {acoes.faltou && (
              <DropdownMenuItem onClick={() => handleStatusChange('no_show')}>
                <UserX className="mr-2 h-4 w-4 text-warning" />
                <span>
                  {labels.no_show || "Faltou"}
                </span>
              </DropdownMenuItem>
            )}

            {acoes.pagar && (
              <>
                <DropdownMenuLabel>
                  {labels.confirm_payment || "Confirmar pagamento"}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {METODOS_NOS_MENUS.map((metodo) => (
                  <DropdownMenuItem key={metodo} onClick={() => handlePayment(metodo)}>
                    {metodo === 'dinheiro' ? (
                      <Banknote className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : metodo === 'pix' ? (
                      <QrCode className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{rotuloMetodo(metodo, labels)}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {acoes.cancelar && (
              <>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleCancel}
                  className="text-destructive"
                >
                  <Ban className="mr-2 h-4 w-4" />
                  <span>
                    {labels.cancel || "Cancelar"}
                  </span>
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}