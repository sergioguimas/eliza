'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAppointment } from "@/app/actions/create-appointment"
import { toast } from "sonner"
import { Loader2, CalendarIcon, Clock, User, Plus, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface CreateAppointmentDialogProps {
  customers?: any[] 
  services?: any[]  
  professionals?: any[] 
  staff?: any[] 
  organization_id: string
  currentUser: any
  
  // Props de Pré-seleção
  preselectedDate?: Date | null
  preselectedProfessionalId?: string | null
  preselectedCustomerId?: string | null
  preselectedServiceId?: string | null

  settings?: any
  
  open?: boolean 
  onOpenChange?: (open: boolean) => void
}

export function CreateAppointmentDialog({ 
  customers = [], 
  services = [], 
  professionals = [],
  staff = [],
  currentUser,
  preselectedDate,
  preselectedProfessionalId,
  preselectedCustomerId,
  preselectedServiceId,
  organization_id,
  settings,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: CreateAppointmentDialogProps) {
  
  const router = useRouter()
  
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? setControlledOpen : setInternalOpen

  const [isLoading, setIsLoading] = useState(false)
  const [showOutsideHoursAlert, setShowOutsideHoursAlert] = useState(false) 
  
  const team = professionals.length > 0 ? professionals : staff

  // States do formulário
  const [customerId, setCustomerId] = useState("new")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("")

  // EFEITO: Preencher formulário ao abrir
  useEffect(() => {
    if (open) {
      // 1. Resetar campos que não foram pré-selecionados
      setCustomerName("")
      setCustomerPhone("")
      setNotes("")
      setIsLoading(false)
      setShowOutsideHoursAlert(false)

      // 2. Preencher Data e Hora
      if (preselectedDate) {
        const year = preselectedDate.getFullYear()
        const month = String(preselectedDate.getMonth() + 1).padStart(2, '0')
        const day = String(preselectedDate.getDate()).padStart(2, '0')
        setDate(`${year}-${month}-${day}`)

        const hours = preselectedDate.getHours()
        const minutes = preselectedDate.getMinutes()
        if (hours !== 0 || minutes !== 0) {
             setTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
        } else {
             setTime("")
        }
      } else {
        setDate(new Date().toISOString().split('T')[0])
        setTime("")
      }
      
      // 3. Preencher Profissional
      if (preselectedProfessionalId && preselectedProfessionalId !== 'all') {
         setSelectedProfessionalId(preselectedProfessionalId)
      } else if (currentUser?.role === 'professional' || currentUser?.role === 'owner') {
        setSelectedProfessionalId(currentUser.id)
      } else if (team.length > 0) {
        setSelectedProfessionalId(team[0].id)
      }

      // 4. Preencher Cliente (NOVO)
      if (preselectedCustomerId) {
        setCustomerId(preselectedCustomerId)
      } else {
        setCustomerId("new")
      }

      // 5. Preencher Serviço (NOVO)
      if (preselectedServiceId) {
        setServiceId(preselectedServiceId)
      } else {
        setServiceId("")
      }
    }
  }, [open, preselectedDate, preselectedProfessionalId, preselectedCustomerId, preselectedServiceId, currentUser, team])

  const isWithinBusinessHours = (dateStr: string, timeStr: string) => {
    if (!settings) return true;

    const selectedDate = new Date(`${dateStr}T${timeStr}`);
    const dayOfWeek = selectedDate.getDay(); 

    if (settings.days_of_week && !settings.days_of_week.includes(dayOfWeek)) {
        return false;
    }

    const start = settings.open_hours_start || "08:00";
    const end = settings.open_hours_end || "18:00";
    
    if (timeStr < start || timeStr > end) {
        return false;
    }

    if (settings.lunch_start && settings.lunch_end) {
        if (timeStr >= settings.lunch_start && timeStr < settings.lunch_end) {
            return false;
        }
    }

    return true;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !time) {
        toast.error("Preencha data e hora.");
        return;
    }

    if (!isWithinBusinessHours(date, time)) {
        setShowOutsideHoursAlert(true);
    } else {
        performSubmit();
    }
  }

  async function performSubmit() {
    setShowOutsideHoursAlert(false);
    
    const finalCustomerName = customerId === 'new' ? customerName : customers.find(c => c.id === customerId)?.name
    
    if (!date || !time || !finalCustomerName || !selectedProfessionalId) {
      toast.error("Preencha data, hora, paciente e profissional.")
      return
    }

    setIsLoading(true)

    const formData = new FormData()
    formData.append('organization_id', organization_id) 
    const combinedDateTime = `${date}T${time}:00`
    formData.append('start_time', combinedDateTime)

    if (customerId === 'new') {
        formData.append('customer_name', customerName)
        formData.append('customer_phone', customerPhone)
    } else {
        formData.append('customer_id', customerId)
    }
    
    if (serviceId) formData.append('service_id', serviceId)
    formData.append('notes', notes)
    formData.append('professional_id', selectedProfessionalId)

    try {
        const result = await createAppointment(formData)

        if (result?.error) {
          toast.error(result.error)
        } else {
          toast.success("Agendamento criado com sucesso!")
          if (setOpen) setOpen(false)
          router.refresh()
        }
    } catch (error) {
        toast.error("Erro inesperado ao criar agendamento.")
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <>
        <Dialog open={open} onOpenChange={setOpen}>
        {!isControlled && (
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Agendamento
                </Button>
            </DialogTrigger>
        )}
        
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handlePreSubmit} className="space-y-4 py-2">
            
            {/* Profissional */}
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
                                {prof.name || prof.email}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="border-t my-2" />

            {/* Paciente */}
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

            {/* Serviço */}
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

            {/* Data e Hora */}
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

        {/* ALERTA DE FORA DE HORÁRIO */}
        <AlertDialog open={showOutsideHoursAlert} onOpenChange={setShowOutsideHoursAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-5 w-5" />
                        Atenção: Fora de Horário
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        O horário selecionado ({time}) parece estar fora do expediente ou durante o intervalo de almoço configurado.
                        <br /><br />
                        Deseja agendar mesmo assim?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => performSubmit()} className="bg-amber-600 hover:bg-amber-700">
                        Sim, agendar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  )
}