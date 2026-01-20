'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAppointment } from "@/app/actions/create-appointment"
import { toast } from "sonner"
import { Loader2, CalendarIcon, Clock, User, Plus, Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Interface completa para alinhar com o CalendarView
interface CreateAppointmentDialogProps {
  customers?: any[] // Lista de clientes para o select
  services?: any[]  // Lista de serviços para o select
  professionals?: any[] // Lista de médicos
  staff?: any[] // Caso venha com nome de staff (alias para professionals)
  organization_id: string
  currentUser: any
  preselectedDate?: Date | null // Data clicada no calendário
}

export function CreateAppointmentDialog({ 
  customers = [], 
  services = [], 
  professionals = [],
  staff = [], // Fallback
  currentUser,
  preselectedDate,
  organization_id
}: CreateAppointmentDialogProps) {
  
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Unifica a lista de profissionais
  const team = professionals.length > 0 ? professionals : staff

  // States do formulário
  const [customerId, setCustomerId] = useState("new") // 'new' ou ID do cliente
  const [customerName, setCustomerName] = useState("") // Usado se for cliente novo
  const [customerPhone, setCustomerPhone] = useState("")
  
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("")

  // Quando o modal abre, reseta ou configura defaults
  useEffect(() => {
    if (open) {
      // 1. Data e Hora
      if (preselectedDate) {
        setDate(preselectedDate.toISOString().split('T')[0])
        // Se quiser setar a hora atual arredondada, pode fazer aqui
      } else {
        setDate(new Date().toISOString().split('T')[0])
      }
      
      // 2. Profissional Padrão
      if (currentUser?.role === 'professional' || currentUser?.role === 'owner') {
        setSelectedProfessionalId(currentUser.id)
      } else if (team.length > 0 && !selectedProfessionalId) {
        setSelectedProfessionalId(team[0].id)
      }
    }
  }, [open, preselectedDate, currentUser, team])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validação básica
    const finalCustomerName = customerId === 'new' ? customerName : customers.find(c => c.id === customerId)?.name
    
    if (!date || !time || !finalCustomerName || !selectedProfessionalId) {
      toast.error("Preencha data, hora, paciente e profissional.")
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    // 1. INJEÇÃO DO ID DA ORGANIZAÇÃO
    formData.append('organization_id', organization_id) 

    // 2. UNIFICAÇÃO DE DATA E HORA
    const combinedDateTime = `${date}T${time}:00`
    formData.append('start_time', combinedDateTime)

    // 3. LÓGICA DE CLIENTE
    if (customerId === 'new') {
        formData.append('customer_name', customerName)
        formData.append('customer_phone', customerPhone)
    } else {
        formData.append('customer_id', customerId)
    }
    
    // 4. SERVIÇO
    if (serviceId) {
        formData.append('service_id', serviceId)
    }
    
    // 5. OBSERVAÇÕES E PROFISSIONAL
    formData.append('notes', notes)
    formData.append('professional_id', selectedProfessionalId)

    const result = await createAppointment(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Agendamento criado com sucesso!")
      setOpen(false)
      // Limpa campos críticos
      setCustomerName("")
      setCustomerPhone("")
      setNotes("")

      // Recarrega a página para atualizar o calendário
      router.refresh()
    }
    
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo Agendamento
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          
          {/* 1. SELEÇÃO DE PROFISSIONAL (Obrigatório no Multi-Profissional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                <User className="w-3 h-3" />
                Profissional
            </Label>
            <Select 
                value={selectedProfessionalId} 
                onValueChange={setSelectedProfessionalId}
                disabled={currentUser?.role === 'professional'} 
            >
                <SelectTrigger className="bg-muted/20">
                    <SelectValue placeholder="Selecione o especialista" />
                </SelectTrigger>
                <SelectContent>
                    {team.map(prof => (
                        <SelectItem key={prof.id} value={prof.id}>
                            {prof.full_name || prof.email}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          <div className="border-t my-2" />

          {/* 2. CLIENTE (Existente ou Novo) */}
          <div className="space-y-2">
            <Label>Paciente</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite novo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="new" className="font-bold text-primary">
                        + Novo Paciente
                    </SelectItem>
                    {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                            {c.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {customerId === 'new' && (
                <div className="grid grid-cols-2 gap-2 mt-2 animate-in slide-in-from-top-2">
                    <Input 
                        placeholder="Nome Completo" 
                        value={customerName} 
                        onChange={e => setCustomerName(e.target.value)}
                        required={customerId === 'new'}
                    />
                    <Input 
                        placeholder="Telefone / WhatsApp" 
                        value={customerPhone} 
                        onChange={e => setCustomerPhone(e.target.value)} 
                    />
                </div>
            )}
          </div>

          {/* 3. SERVIÇO */}
          <div className="space-y-2">
            <Label>Procedimento / Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço (Opcional)" />
                </SelectTrigger>
                <SelectContent>
                    {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                            <div className="flex items-center gap-2">
                                {s.color && (
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                )}
                                {s.title}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>

          {/* 4. DATA E HORA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                Data
              </Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Horário
              </Label>
              <Input 
                type="time" 
                value={time} 
                onChange={e => setTime(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
             <Label>Observações</Label>
             <Textarea 
                placeholder="Ex: Primeira consulta, convênio, etc..." 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="resize-none"
             />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}