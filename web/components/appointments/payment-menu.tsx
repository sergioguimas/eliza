'use client'

import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  CheckCircle2,
  QrCode,
  CreditCard,
  Banknote,
  MoreHorizontal,
} from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

interface BaixaPagamentoProps {
  appointmentId: string
  paymentStatus: string
  paymentMethod?: string
}

export function BaixaPagamentoButton({
  appointmentId,
  paymentStatus,
  paymentMethod,
}: BaixaPagamentoProps) {
  const { dict } = useKeckleon()

  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const labelPix = actions.pix || "Pix"
  const labelCreditCard = actions.credit_card || "Cartão de crédito"
  const labelDebitCard = actions.debit_card || "Cartão de débito"
  const labelCash = actions.cash || "Dinheiro"
  const labelOther = actions.other || "Outro"

  if (paymentStatus === "paid") {
    return (
      <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span className="capitalize">{paymentMethod || messages.payment_done || "Pago"}</span>
      </div>
    )
  }

  const handleBaixa = async (metodo: string) => {
    const res = await updateAppointmentPayment(appointmentId, metodo)

    if (res.success) {
      toast.success(messages.payment_success || "Pagamento confirmado!")
    } else {
      toast.error(messages.payment_error || "Erro ao processar pagamento.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
        >
          {actions.confirm_payment || "Confirmar pagamento"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          {messages.payment_method || "Forma de pagamento"}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => handleBaixa("pix")}
          className="gap-2 cursor-pointer"
        >
          <QrCode className="h-4 w-4 text-muted-foreground" />
          {labelPix}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleBaixa("cartao_credito")}
          className="gap-2 cursor-pointer"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {labelCreditCard}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleBaixa("cartao_debito")}
          className="gap-2 cursor-pointer"
        >
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {labelDebitCard}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleBaixa("dinheiro")}
          className="gap-2 cursor-pointer"
        >
          <Banknote className="h-4 w-4 text-muted-foreground" />
          {labelCash}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleBaixa("outro")}
          className="gap-2 cursor-pointer"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          {labelOther}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}