'use client'

import { useState } from "react"
import { Check, X, Clock, User, Calendar, ClipboardPenLineIcon, IdCardLanyard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { handleAppointmentRequest } from "@/app/actions/handle-appointment-request"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PendingRequest {
  id: string
  start_time: string
  customers: { name: string } | null
  services: { title: string } | null
  professionals: { name: string } | null
}

export function PendingRequestsList({ initialRequests }: { initialRequests: PendingRequest[] }) {
  const [requests, setRequests] = useState(initialRequests)

  async function onHandle(id: string, action: 'confirm' | 'reject') {
    const result = await handleAppointmentRequest(id, action)
    
    if (result.success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      toast.success(action === 'confirm' ? "Agendamento confirmado!" : "Agendamento recusado.")
    } else {
      toast.error("Erro ao processar solicitação.")
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Clock className="h-10 w-10 mb-2 opacity-20" />
        <p>Nenhuma solicitação pendente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div key={req.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{req.customers?.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(req.start_time), "dd 'de' MMMM", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(req.start_time), "HH:mm")}
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <ClipboardPenLineIcon className="h-3 w-3" />
                {req.services?.title}
              </div>
              <div className="flex items-center gap-1">
                <IdCardLanyard className="h-3 w-3" />
                {req.professionals?.name}
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-green-500 border-green-500/20 hover:bg-green-500/10"
              onClick={() => onHandle(req.id, 'confirm')}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-red-500 border-red-500/20 hover:bg-red-500/10"
              onClick={() => onHandle(req.id, 'reject')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}