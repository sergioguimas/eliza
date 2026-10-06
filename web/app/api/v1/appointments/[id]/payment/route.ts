import { PaymentBody } from "@/contracts/api-v1"
import { apiRoute } from "@/lib/api/handler"
import { atorDaChave } from "@/lib/api/notificacao"
import { paraAppointment } from "@/lib/api/serializar"
import { registrarPagamento } from "@/lib/domain/agendamentos"

/**
 * Baixa de pagamento. Recusada em canceled/no_show; antes de concluir vale como sinal (D10);
 * repetir "paid" não altera paid_at. Não notifica o cliente.
 * Exige o escopo `payments` (D5): `write` sozinho não dá baixa financeira.
 */
export const POST = apiRoute("payments", async ({ db, organizationId, keyPrefix, params, body }) => {
  const { method, status } = await body(PaymentBody)

  const { agendamento } = await registrarPagamento(db, atorDaChave({ organizationId, keyPrefix }, null), params.id, {
    metodo: method,
    status,
  })

  return { data: paraAppointment(agendamento) }
})
