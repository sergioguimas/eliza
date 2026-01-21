'use client'

import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuTrigger, 
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from "@/components/ui/context-menu"
import { updateAppointmentStatus } from "@/app/actions/update-appointment-status"
import { cancelAppointment } from "@/app/actions/cancel-appointment"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function AppointmentContextMenu({ children, appointment, className }: any) {
  const router = useRouter() // <--- 2. Inicializa o router

  async function handleStatusChange(newStatus: string) {
    if (!appointment?.id) return

    const result = await updateAppointmentStatus(appointment.id, newStatus)
    
    if (result.success) {
      // Lógica especial para quando conclui o agendamento
      if (newStatus === 'completed') {
        // Tenta pegar o ID do cliente de onde estiver disponível (objeto customers ou customer_id direto)
        const customerId = appointment.customers?.id || appointment.customer_id

        if (customerId) {
          toast.success("Agendamento concluído!", {
            description: "Deseja adicionar o registro clínico agora?",
            action: {
              label: "Criar Registro",
              onClick: () => {
                // <--- 3. Redirecionamento seguro com o ID verificado
                router.push(`/clientes/${customerId}?tab=history`)
              }
            },
            duration: 8000,
          })
        } else {
          // Se não tiver ID do cliente, mostra apenas o sucesso simples
          toast.success("Status atualizado para Concluído!")
        }
      } else {
        // Outros status
        toast.success(`Status atualizado!`)
      }
    } else {
      toast.error("Erro ao atualizar status")
    }
  }

  async function handleCancel() {
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
      const result = await cancelAppointment(appointment.id)
      if (result.success) {
        toast.success("Agendamento cancelado com sucesso")
      } else {
        toast.error("Erro ao cancelar")
      }
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-background border-border text-zinc-200">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Alterar Status</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-background border-border text-zinc-200">
            {Object.entries(STATUS_CONFIG).map(([key, value]) => (
              <ContextMenuItem 
                key={key} 
                onClick={() => handleStatusChange(key)}
                className="gap-2"
              >
                <value.icon className="h-4 w-4" />
                {value.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator className="bg-zinc-800" />
        
        <ContextMenuItem 
          onClick={handleCancel}
          className="text-red-400 focus:text-red-400 gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Cancelar Agendamento
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}