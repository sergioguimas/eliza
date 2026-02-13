'use client'

import { updateAppointmentPayment } from "@/app/actions/update-appointment-payment"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CheckCircle2, QrCode, CreditCard, Banknote, MoreHorizontal } from "lucide-react"

interface BaixaPagamentoProps {
  appointmentId: string
  paymentStatus: string
  paymentMethod?: string
}

export function BaixaPagamentoButton({ appointmentId, paymentStatus, paymentMethod }: BaixaPagamentoProps) {
  
  if (paymentStatus === 'paid') {
    return (
      <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span className="capitalize">{paymentMethod || 'Pago'}</span>
      </div>
    )
  }

  const handleBaixa = async (metodo: string) => {
    const res = await updateAppointmentPayment(appointmentId, metodo)
    if (res.success) {
      toast.success(`Pagamento em ${metodo} confirmado!`)
    } else {
      toast.error("Erro ao processar pagamento.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
          Dar Baixa
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Forma de Pagamento</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleBaixa('pix')} className="gap-2 cursor-pointer">
          <QrCode className="h-4 w-4 text-muted-foreground" /> Pix
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleBaixa('cartao_credito')} className="gap-2 cursor-pointer">
          <CreditCard className="h-4 w-4 text-muted-foreground" /> Cartão de Crédito
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleBaixa('dinheiro')} className="gap-2 cursor-pointer">
          <Banknote className="h-4 w-4 text-muted-foreground" /> Dinheiro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleBaixa('outro')} className="gap-2 cursor-pointer">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" /> Outro
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}