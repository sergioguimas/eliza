'use client'

import { useState } from "react"
import { MoreHorizontal, Check, UserCheck, CheckCircle, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { cancelAppointment } from "@/app/actions/cancel-appointment"

interface AppointmentCardActionsProps {
  appointment: any
}

export function AppointmentCardActions({ appointment }: AppointmentCardActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Função genérica para atualizar status
  async function updateStatus(status: string, label: string) {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointment.id)

      if (error) throw error
      
      toast.success(`Status atualizado: ${label}`)
      router.refresh()
    } catch (error) {
      toast.error("Erro ao atualizar status")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    setLoading(true)
    const result = await cancelAppointment(appointment.id)
    if (result?.error) {
        toast.error(result.error)
    } else {
        toast.success("Agendamento cancelado")
    }
    setLoading(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800 text-zinc-200">
        <DropdownMenuLabel>Ações Rápidas</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        
        <DropdownMenuItem 
            onClick={() => updateStatus('confirmed', 'Confirmado')}
            disabled={loading}
            className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
        >
          <Check className="mr-2 h-4 w-4 text-blue-500" />
          <span>Confirmar</span>
        </DropdownMenuItem>

        <DropdownMenuItem 
            onClick={() => updateStatus('arrived', 'Na Recepção')}
            disabled={loading}
            className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
        >
          <UserCheck className="mr-2 h-4 w-4 text-amber-500" />
          <span>Chegou</span>
        </DropdownMenuItem>

        <DropdownMenuItem 
            onClick={() => updateStatus('completed', 'Finalizado')}
            disabled={loading}
            className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
        >
          <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
          <span>Finalizar</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-zinc-800" />
        
        <DropdownMenuItem 
            onClick={handleCancel}
            disabled={loading}
            className="text-red-500 focus:text-red-400 focus:bg-red-950/20 cursor-pointer"
        >
          <Ban className="mr-2 h-4 w-4" />
          <span>Cancelar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}