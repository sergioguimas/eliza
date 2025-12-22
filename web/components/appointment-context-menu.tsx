'use client'

import { useState } from "react"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { Check, Clock } from "lucide-react" 
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface AppointmentContextMenuProps {
  children: React.ReactNode
  appointment: any
  className?: string
}

export function AppointmentContextMenu({ children, appointment, className }: AppointmentContextMenuProps) {
  const [loading, setLoading] = useState(false)
  const currentStatus = appointment.status || 'scheduled'

  async function handleStatusChange(newStatus: string) {
    if (newStatus === currentStatus) return
    
    setLoading(true)
    const result = await updateAppointmentStatus(appointment.id, newStatus)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(`Status alterado para: ${STATUS_CONFIG[newStatus].label}`)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Renderiza o card do agendamento (o children) como gatilho do menu */}
        <div className={cn("h-full w-full cursor-pointer outline-none", className)}>
          {children}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-300" align="start">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Opções</span>
          <span className="text-xs font-normal text-zinc-500">{STATUS_CONFIG[currentStatus]?.label}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-zinc-800" />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="focus:bg-zinc-800 cursor-pointer">
            <Clock className="mr-2 h-4 w-4" /> Mudar Status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
            <DropdownMenuRadioGroup value={currentStatus} onValueChange={handleStatusChange}>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <DropdownMenuRadioItem key={key} value={key} className="focus:bg-zinc-800 cursor-pointer">
                    <Icon className={cn("mr-2 h-4 w-4", config.color.replace('bg-', 'text-').replace('/10', ''))} />
                    {config.label}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-zinc-800" />
        <DropdownMenuItem className="focus:bg-zinc-800 cursor-pointer text-zinc-400">
          Editar Agendamento
        </DropdownMenuItem>
        <DropdownMenuItem className="focus:bg-red-950/30 text-red-500 focus:text-red-400 cursor-pointer">
           Cancelar / Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}