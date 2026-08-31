'use client'

import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Wallet,
  Calendar,
  CheckCircle2,
  CreditCard,
  Banknote,
  QrCode,
  MoreHorizontal,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { updateExpenseStatus } from "@/app/actions/update-expense-status"
import { toast } from "sonner"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useKeckleon } from "@/providers/keckleon-provider"

export function FinancialCards({ data }: { data: any }) {
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const cliente = entities.cliente || "Cliente"
  const servico = entities.servico || "Serviço"

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val)

  const confirmPayment = async (appointmentId: string, method: string) => {
    const res = await updateAppointmentPayment(appointmentId, method)

    if (res.success) {
      toast.success(messages.payment_success || "Pagamento confirmado!")
    } else {
      toast.error(messages.payment_error || "Erro ao processar pagamento.")
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-success">
                {messages.received_cash_title || "Recebido (Caixa)"}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(data.recebido)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {messages.click_to_view_history || "Clique para ver histórico"}
              </p>
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-xl bg-card">
          <DialogHeader>
            <DialogTitle>
              {messages.receipts_history_title || "Histórico de recebimentos"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {data.listaRecebidos.map((item: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group"
              >
                <div>
                  <p className="text-sm font-bold">
                    {item.customers?.name || cliente}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.services?.title || servico} •{" "}
                    {new Date(item.start_time).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-bold">
                      {formatCurrency(item.price)}
                    </p>

                    <Badge
                      variant="outline"
                      className={
                        item.payment_status === "paid"
                          ? "text-success border-success/40"
                          : "text-warning border-warning/40"
                      }
                    >
                      {item.payment_status === "paid"
                        ? messages.payment_done || "Pago"
                        : messages.pending_label || "Pendente"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-danger">
                {messages.expenses_title || "Despesas"}
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-danger" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">
                {formatCurrency(data.despesasTotal)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {messages.click_manage_bills || "Clique para gerenciar contas"}
              </p>
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-xl bg-card">
          <DialogHeader>
            <DialogTitle>
              {messages.accounts_payable_title || "Contas a pagar / pagas"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {data.listaDespesas.map((expense: any) => (
              <div
                key={expense.id}
                className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group transition-all hover:border-foreground/20"
              >
                <div className="flex gap-3 items-center">
                  {expense.status === "paid" ? (
                    <CheckCircle2 className="text-success h-5 w-5" />
                  ) : (
                    <Calendar className="text-warning h-5 w-5" />
                  )}

                  <div>
                    <p className="text-sm font-bold">{expense.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {messages.due_date_label || "Vence em"}:{" "}
                      {new Date(expense.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm">
                      {formatCurrency(expense.amount)}
                    </p>

                    <Badge
                      variant="outline"
                      className={
                        expense.status === "paid"
                          ? "text-success border-success/40"
                          : "text-warning border-warning/40"
                      }
                    >
                      {expense.status === "paid"
                        ? messages.payment_done?.toUpperCase() || "PAGO"
                        : messages.to_pay_label || "A PAGAR"}
                    </Badge>
                  </div>

                  {expense.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs text-success border border-success/40 hover:bg-accent/50"
                      onClick={async (e) => {
                        e.preventDefault()
                        const res = await updateExpenseStatus(expense.id, "paid")
                        if (res.success) {
                          toast.success(
                            messages.expense_paid_success ||
                              "Pagamento baixado com sucesso!"
                          )
                        }
                      }}
                    >
                      {actions.mark_paid || "Baixar"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer hover:bg-accent/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-warning">
                {messages.to_receive_title || "A receber"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(data.aPrazo)}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {messages.future_cashflow || "Fluxo futuro estimado"}
              </p>
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="max-w-xl bg-card">
          <DialogHeader>
            <DialogTitle>
              {messages.values_to_receive_title || "Valores a receber"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {data.listaPrazo.map((item: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group"
              >
                <div>
                  <p className="text-sm font-bold">
                    {item.customers?.name || cliente}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.services?.title || servico} •{" "}
                    {new Date(item.start_time).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-bold">
                      {formatCurrency(item.price)}
                    </p>

                    <Badge
                      variant="outline"
                      className={
                        item.payment_status === "paid"
                          ? "text-success border-success/40"
                          : "text-warning border-warning/40"
                      }
                    >
                      {item.payment_status === "paid"
                        ? messages.payment_done || "Pago"
                        : messages.pending_label || "Pendente"}
                    </Badge>
                  </div>

                  {item.payment_status !== "paid" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-2 border-success/40 text-success hover:bg-accent/50"
                        >
                          {actions.mark_paid || "Baixar"}{" "}
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>
                          {messages.payment_method || "Forma de pagamento"}
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => confirmPayment(item.id, "pix")}
                          className="gap-2"
                        >
                          <QrCode className="h-4 w-4 text-muted-foreground" />
                          {actions.pix || "Pix"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => confirmPayment(item.id, "cartao_credito")}
                          className="gap-2"
                        >
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {actions.credit_card || "Cartão de crédito"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => confirmPayment(item.id, "cartao_debito")}
                          className="gap-2"
                        >
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {actions.debit_card || "Cartão de débito"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => confirmPayment(item.id, "dinheiro")}
                          className="gap-2"
                        >
                          <Banknote className="h-4 w-4 text-muted-foreground" />
                          {actions.cash || "Dinheiro"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => confirmPayment(item.id, "outro")}
                          className="gap-2"
                        >
                          <Banknote className="h-4 w-4 text-muted-foreground" />
                          {actions.other || "Outro"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {messages.real_balance_title || "Saldo real"}
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.recebido - data.despesasTotal)}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {messages.current_cashflow || "Caixa atual líquido"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}