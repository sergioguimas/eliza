'use client'

import { DollarSign, TrendingUp, AlertCircle, Wallet, Calendar, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { CreditCard, Banknote, QrCode, MoreHorizontal } from "lucide-react"

export function FinancialCards({ data }: { data: any }) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      
      {/* CARD DE RECEBIDOS (CLICÁVEL) */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-500">Recebido (Caixa)</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(data.recebido)}</div>
              <p className="text-[10px] text-muted-foreground">Clique para ver histórico</p>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-xl bg-card">
          <DialogHeader><DialogTitle>Histórico de Recebimentos</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {data.listaRecebidos.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group">
                <div>
                  <p className="text-sm font-bold">{item.customers?.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.services?.title} • {new Date(item.start_time).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-600">{formatCurrency(item.price)}</p>
                    <Badge variant={item.payment_status === 'paid' ? 'default' : 'outline'} 
                          className={item.payment_status === 'paid' ? 'bg-emerald-600' : 'text-amber-500 border-amber-500'}>
                      {item.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* CARD DE DESPESAS (CLICÁVEL) */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="border-red-500/20 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-500">Despesas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(data.despesasTotal)}</div>
              <p className="text-[10px] text-muted-foreground">Clique para gerenciar contas</p>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-xl bg-card">
          <DialogHeader><DialogTitle>Contas a Pagar / Pagas</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {data.listaDespesas.map((expense: any) => (
              <div key={expense.id} className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group transition-all hover:border-emerald-500/30">
                <div className="flex gap-3 items-center">
                  {expense.status === 'paid' ? (
                    <CheckCircle2 className="text-emerald-500 h-5 w-5" />
                  ) : (
                    <Calendar className="text-amber-500 h-5 w-5" />
                  )}
                  <div>
                    <p className="text-sm font-bold">{expense.description}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Vence em: {new Date(expense.due_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-mono font-bold text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
                    </p>
                    <Badge variant="outline" className={expense.status === 'paid' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 'text-amber-500 border-amber-500/30'}>
                      {expense.status === 'paid' ? 'PAGO' : 'A PAGAR'}
                    </Badge>
                  </div>

                  {/* Botão Condicional: Só aparece se estiver pendente */}
                  {expense.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 text-xs hover:bg-emerald-500/10 hover:text-emerald-500 border border-emerald-500/20"
                      onClick={async (e) => {
                        e.preventDefault();
                        const res = await updateExpenseStatus(expense.id, 'paid');
                        if (res.success) toast.success("Pagamento baixado com sucesso!");
                      }}
                    >
                      Baixar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* CARD A RECEBER (CLICÁVEL) */}
      <Dialog>
        <DialogTrigger asChild>
          <Card className="border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-500">A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(data.aPrazo)}</div>
              <p className="text-[10px] text-muted-foreground text-amber-600/70">Fluxo futuro estimado</p>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="max-w-xl bg-card">
          <DialogHeader><DialogTitle>Valores a receber</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {data.listaPrazo.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg border bg-secondary/10 group">
                <div>
                  <p className="text-sm font-bold">{item.customers?.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.services?.title} • {new Date(item.start_time).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-bold text-emerald-600">{formatCurrency(item.price)}</p>
                    <Badge variant={item.payment_status === 'paid' ? 'default' : 'outline'} 
                          className={item.payment_status === 'paid' ? 'bg-emerald-600' : 'text-amber-500 border-amber-500'}>
                      {item.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                    </Badge>
                  </div>

                  {/* BOTÃO DE BAIXA DE PAGAMENTO */}
                  {item.payment_status !== 'paid' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10">
                          Baixar <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Forma de Pagamento</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={async () => {
                            const res = await updateAppointmentPayment(item.id, 'pix');
                            if (res.success) {
                              toast.success("Pagamento em Pix confirmado!");
                            } else {
                              toast.error("Erro ao processar baixa.");
                            }
                          }} 
                          className="gap-2"
                        >
                          <QrCode className="h-4 w-4 text-muted-foreground" /> Pix
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            const res = await updateAppointmentPayment(item.id, 'cartao_credito');
                            if (res.success) {
                              toast.success("Pagamento em Cartão confirmado!");
                            } else {
                              toast.error("Erro ao processar baixa.");
                            }
                          }} 
                          className="gap-2"
                        >
                          <CreditCard className="h-4 w-4 text-muted-foreground" /> Cartão de Crédito
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            const res = await updateAppointmentPayment(item.id, 'cartao_debito');
                            if (res.success) {
                              toast.success("Pagamento em Cartão confirmado!");
                            } else {
                              toast.error("Erro ao processar baixa.");
                            }
                          }} 
                          className="gap-2"
                        >
                          <CreditCard className="h-4 w-4 text-muted-foreground" /> Cartão de Débito
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            const res = await updateAppointmentPayment(item.id, 'dinheiro');
                            if (res.success) {
                              toast.success("Pagamento em Dinheiro confirmado!");
                            } else {
                              toast.error("Erro ao processar baixa.");
                            }
                          }} 
                          className="gap-2"
                        >
                          <Banknote className="h-4 w-4 text-muted-foreground" /> Dinheiro
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={async () => {
                            const res = await updateAppointmentPayment(item.id, 'outro');
                            if (res.success) {
                              toast.success("Pagamento em Dinheiro confirmado!");
                            } else {
                              toast.error("Erro ao processar baixa.");
                            }
                          }} 
                          className="gap-2"
                        >
                          <Banknote className="h-4 w-4 text-muted-foreground" /> Outro meio
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
        
      {/* CARD SALDO (EM CONSTRUÇÃO) */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-500">Saldo Real</CardTitle>
          <Wallet className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.recebido - data.despesasTotal)}</div>
          <p className="text-[10px] text-muted-foreground">Caixa atual líquido</p>
        </CardContent>
      </Card>
    </div>
  )
}