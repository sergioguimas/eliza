'use client'

import { useState } from "react"
import {
  Check,
  X,
  Clock,
  User,
  Calendar,
  ClipboardPenLineIcon,
  IdCardLanyard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { handleAppointmentRequest } from "@/app/actions/handle-appointment-request"
import { toast } from "sonner"
import { formatSaoPauloDayMonth, formatSaoPauloTime } from "@/lib/utils"
import { useKeckleon } from "@/providers/keckleon-provider"

interface PendingRequest {
  id: string
  start_time: string
  professional_id?: string | null
  customers: { name: string } | null
  services: { title: string } | null
  professionals: { name: string } | null
}

export function PendingRequestsList({
  initialRequests,
}: {
  initialRequests: PendingRequest[]
}) {
  const [requests, setRequests] = useState(initialRequests)
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const agendamento = entities.agendamento || "Agendamento"
  const cliente = entities.cliente || "Cliente"
  const servico = entities.servico || "Serviço"
  const profissional = entities.profissional || "Profissional"

  async function onHandle(id: string, action: "confirm" | "reject") {
    const result = await handleAppointmentRequest(id, action)

    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== id))
      toast.success(
        action === "confirm"
          ? messages.request_confirmed_success || `${agendamento} confirmado!`
          : messages.request_rejected_success || `${agendamento} recusado.`
      )
    } else {
      toast.error(result.error || messages.request_error || "Erro ao processar solicitação.")
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Clock className="h-10 w-10 mb-2 opacity-20" />
        <p>{messages.no_pending_requests || "Nenhuma solicitação pendente."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const isOpenRequest = !req.professional_id

        return (
          <div
            key={req.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {req.customers?.name || cliente}
                </span>

                {isOpenRequest && (
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    A definir
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatSaoPauloDayMonth(req.start_time)}
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatSaoPauloTime(req.start_time)}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <ClipboardPenLineIcon className="h-3 w-3" />
                  {req.services?.title || servico}
                </div>

                <div className="flex items-center gap-1">
                  <IdCardLanyard className="h-3 w-3" />
                  {req.professionals?.name || "A definir"}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-500 border-green-500/20 hover:bg-green-500/10"
                title={
                  isOpenRequest
                    ? `Assumir ${agendamento.toLowerCase()}`
                    : actions.confirm || "Confirmar"
                }
                onClick={() => onHandle(req.id, "confirm")}
              >
                <Check className="h-4 w-4" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                title={actions.cancel || "Recusar"}
                onClick={() => onHandle(req.id, "reject")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}