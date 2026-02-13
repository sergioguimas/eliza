'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Check, UserCheck, CheckCircle2, Ban, QrCode, CreditCard, Banknote, MoreHorizontal as MoreIcon } from "lucide-react"
import { toast } from "sonner"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment, deleteAppointment } from "@/app/actions/delete-appointment"
import { useState } from "react"
import { useRouter } from "next/dist/client/components/navigation"
import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"

export function AppointmentCardActions({ appointment }: { appointment: any }) {
  const router = useRouter()

  async function handleStatusChange(status: string) {
    const result = await updateAppointmentStatus(appointment.id, status)
    
    if (result.success) {
      toast.success(`Status alterado para: ${status}`)
      
      if (status === 'completed') {
        const params = new URLSearchParams(window.location.search)
        params.set('return_check', appointment.id)
        
        // router.replace para não criar histórico de "voltar" desnecessário
        router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
      } else {
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

  const isCompleted = appointment.status === 'completed'
  const isPaid = appointment.payment_status === 'paid'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-slate-200/50 rounded-full">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Abrir menu</span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          {/* CASO 1: AGENDAMENTO JÁ FINALIZADO E NÃO PAGO -> MOSTRAR FINANCEIRO */}
          {isCompleted && !isPaid ? (
            <>
              <DropdownMenuLabel>Confirmar Recebimento</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handlePayment('pix')}>
                <QrCode className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Pix</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePayment('cartao_credito')}>
                <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
                <span>Cartão de Crédito</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePayment('cartao_debito')}>
                <CreditCard className="mr-2 h-4 w-4 text-indigo-500" />
                <span>Cartão de Débito</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePayment('dinheiro')}>
                <Banknote className="mr-2 h-4 w-4 text-amber-500" />
                <span>Dinheiro</span>
              </DropdownMenuItem>
            </>
          ) : isPaid ? (
            // CASO 2: JÁ ESTÁ PAGO
            <DropdownMenuItem disabled>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
              <span>Pagamento Concluído</span>
            </DropdownMenuItem>
          ) : (
            // CASO 3: FLUXO NORMAL (PENDENTE/CONFIRMADO/CHEGOU)
            <>
              <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusChange('confirmed')}>
                <Check className="mr-2 h-4 w-4 text-blue-500" />
                <span>Confirmar</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('arrived')}>
                <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
                <span>Chegou (Recepção)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                <span>Finalizar Atendimento</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCancel} className="text-red-600">
                <Ban className="mr-2 h-4 w-4" />
                <span>Cancelar</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}