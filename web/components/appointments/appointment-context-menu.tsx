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
  UserX,
} from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment } from "@/app/actions/cancel-appointment"
import { useRouter } from "next/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import { useKeckleon } from "@/providers/keckleon-provider"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import {
  acoesDoAgendamento,
  lancarSeErro,
  METODOS_NOS_MENUS,
  rotuloMetodo,
} from "@/components/appointments/acoes-agendamento"

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

  // Única fonte do que mostrar: a máquina de status (ver acoes-agendamento.ts).
  // Mesmo helper do menu "..." do card, então os dois mostram os mesmos itens.
  const acoes = acoesDoAgendamento(appointment)
  const temAcao =
    acoes.confirmar || acoes.chegou || acoes.finalizar || acoes.faltou || acoes.pagar || acoes.cancelar

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)

    if (!result.error) {
      if (onStatusChange) {
        onStatusChange(appointment, status)
      }

      // Mesmo evento que o menu de ações dispara — o visitante pode ter
      // usado qualquer um dos dois caminhos, e o tour precisa reagir aos dois.
      window.dispatchEvent(
        new CustomEvent("eliza:appointment-status-changed", { detail: { status } })
      )

      if (status === "arrived") {
        // Evento dedicado, mesmo padrão de `appointment-card-actions.tsx`
        // (o outro caminho para a mesma ação): o passo "chegou" do tour é
        // popover simples e precisa de um sinal só dele para avançar sem
        // depender do botão "Entendi", que some junto com o popover assim
        // que este menu abre.
        window.dispatchEvent(new CustomEvent("eliza:appointment-arrived"))
      }

      if (status === "completed") {
        const targetUrl = `/clientes/${appointment.customer_id}?return_check=${appointment.id}`

        toast.success(
          messages.appointment_completed_redirect ||
            "Atendimento finalizado! Redirecionando..."
        )

        router.push(targetUrl)
      } else {
        toast.success(
          messages.status_updated || `Status alterado para: ${status}`
        )
        router.refresh()
      }
    } else {
      // Mensagem do domínio (ex.: "alterado por outra pessoa"), não a genérica.
      toast.error(result.error || messages.error_update_status || "Erro ao atualizar status")
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

      toast.success(messages.payment_success || "Pagamento confirmado!")
      router.refresh()
    } else {
      toast.error(result.error || messages.payment_error || "Erro ao processar pagamento")
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

        {!temAcao ? (
          // Nada a oferecer (finalizado e pago, cancelado, faltou...): em vez de
          // um menu vazio, um item desabilitado diz o porquê.
          <ContextMenuItem disabled>
            {appointment.payment_status === "paid" ? (
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
            ) : (
              <Ban className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            <span>
              {appointment.payment_status === "paid"
                ? messages.payment_done || "Pagamento concluído"
                : STATUS_CONFIG[appointment.status]?.label || messages.canceled || "Sem ações"}
            </span>
          </ContextMenuItem>
        ) : (
          <>
            {acoes.confirmar && (
              <ContextMenuItem onClick={() => handleStatusChange("confirmed")}>
                <Check className="mr-2 h-4 w-4 text-info" />
                <span>{actions.confirm || "Confirmar"}</span>
              </ContextMenuItem>
            )}

            {acoes.chegou && (
              <ContextMenuItem onClick={() => handleStatusChange("arrived")}>
                <UserCheck className="mr-2 h-4 w-4 text-warning" />
                <span>{actions.arrived || "Chegada confirmada"}</span>
              </ContextMenuItem>
            )}

            {acoes.finalizar && (
              <ContextMenuItem onClick={() => handleStatusChange("completed")}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                <span>{actions.complete || "Finalizar"}</span>
              </ContextMenuItem>
            )}

            {acoes.faltou && (
              <ContextMenuItem onClick={() => handleStatusChange("no_show")}>
                <UserX className="mr-2 h-4 w-4 text-warning" />
                <span>{actions.no_show || "Faltou"}</span>
              </ContextMenuItem>
            )}

            {acoes.pagar && (
              <>
                <ContextMenuLabel className="text-xs text-muted-foreground">
                  {actions.confirm_payment || "Confirmar pagamento"}
                </ContextMenuLabel>

                {METODOS_NOS_MENUS.map((metodo) => (
                  <ContextMenuItem key={metodo} onClick={() => handlePayment(metodo)}>
                    {metodo === "dinheiro" ? (
                      <Banknote className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : metodo === "pix" ? (
                      <QrCode className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{rotuloMetodo(metodo, actions)}</span>
                  </ContextMenuItem>
                ))}
              </>
            )}

            {acoes.cancelar && (
              <>
                <ContextMenuSeparator />

                <ContextMenuItem onClick={handleCancel} className="text-destructive">
                  <Ban className="mr-2 h-4 w-4" />
                  <span>
                    {actions.cancel || `Cancelar ${agendamentoSingular.toLowerCase()}`}
                  </span>
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}