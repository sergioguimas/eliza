'use client'

import { useState } from "react"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { Clock, Pencil, Trash2 } from "lucide-react"
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
import { EditAppointmentDialog } from "./update-appointment-dialog"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"
import { Database } from "@/lib/database.types"
type AppointmentStatus = Database['public']['Enums']['appointment_status']

interface AppointmentContextMenuProps {
  children: React.ReactNode
  appointment: any
  customers?: { id: string; name: string }[] 
  services?: { id: string; title: string; price: number | null }[]
  className?: string
}

export function AppointmentContextMenu({ 
  children, 
  appointment, 
  className,
  customers = [], // Valor padrão para não quebrar se vier vazio
  services = [] 
}: AppointmentContextMenuProps) {
  
  const [loading, setLoading] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)

  const currentStatus = appointment.status || 'scheduled'

  async function handleStatusChange(newStatus: Database['public']['Enums']['appointment_status']) {
      if (newStatus === currentStatus) return
      setLoading(true)
      
      const result = await updateAppointmentStatus(appointment.id, newStatus)
      setLoading(false)

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Status atualizado!")
      }
    }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
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
              <DropdownMenuRadioGroup value={currentStatus} onValueChange={(value) => handleStatusChange(value as AppointmentStatus)}>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                  const Icon = config.icon
                  return (
                    <DropdownMenuRadioItem key={key} value={key} className="focus:bg-zinc-800 cursor-pointer">
                      <Icon className={cn("mr-2 h-4 w-4", config.color.replace('bg-', 'text-').replace('/10', '').split(' ')[0])} />
                      {config.label}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="bg-zinc-800" />
          
          <DropdownMenuItem 
            className="focus:bg-zinc-800 cursor-pointer text-zinc-400"
            onSelect={(e) => {
              e.preventDefault()
              setIsEditOpen(true)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Editar Agendamento
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            className="focus:bg-red-950/30 text-red-500 focus:text-red-400 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault()
              setIsCancelOpen(true)
            }}
          >
             <Trash2 className="mr-2 h-4 w-4" /> Cancelar / Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Renderiza o Modal de Edição fora do Menu */}
      {isEditOpen && (
        <EditAppointmentDialog 
          open={isEditOpen} 
          onOpenChange={setIsEditOpen}
          appointment={appointment}
          customers={customers}
          services={services}
        />
      )}
      <CancelAppointmentDialog 
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        appointmentId={appointment.id}
      />
    </>
  )
}