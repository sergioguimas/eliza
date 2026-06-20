'use client'

import { useState, useMemo, useEffect } from "react"
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
import { useKeckleon } from "@/providers/keckleon-provider"

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
  
  const team = useMemo(() => {
    return professionals.length > 0 ? professionals : staff
  }, [professionals, staff])

  const firstTeamMemberId = useMemo(() => {
    return team[0]?.id ?? ""
  }, [team])

  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const cliente = entities.cliente || "Cliente"
  const profissional = entities.profissional || "Profissional"
  const servico = entities.servico || "Serviço"
  const agendamento = entities.agendamento || "Agendamento"

  // States do formulário
  const [customerId, setCustomerId] = useState("new")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("")

  // Preencher formulário ao abrir ou quando as props de pré-seleção mudarem
  useEffect(() => {
    if (!open) return

    setCustomerName("")
    setCustomerPhone("")
    setNotes("")
    setIsLoading(false)
    setShowOutsideHoursAlert(false)

    if (preselectedDate) {
      const year = preselectedDate.getFullYear()
      const month = String(preselectedDate.getMonth() + 1).padStart(2, "0")
      const day = String(preselectedDate.getDate()).padStart(2, "0")

      setDate(`${year}-${month}-${day}`)

      const hours = preselectedDate.getHours()
      const minutes = preselectedDate.getMinutes()

      if (hours !== 0 || minutes !== 0) {
        setTime(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`)
      } else {
        setTime("")
      }
    } else {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, "0")
      const day = String(today.getDate()).padStart(2, "0")

      setDate(`${year}-${month}-${day}`)
      setTime("")
    }

    if (preselectedProfessionalId && preselectedProfessionalId !== "all") {
      setSelectedProfessionalId(preselectedProfessionalId)
    } else if (currentUser?.role === "professional") {
      const professionalFromUser = team.find(prof => prof.user_id === currentUser.id)

      setSelectedProfessionalId(professionalFromUser?.id ?? firstTeamMemberId)
    } else if (firstTeamMemberId) {
      setSelectedProfessionalId(firstTeamMemberId)
    } else {
      setSelectedProfessionalId("")
    }

    if (preselectedCustomerId) {
      setCustomerId(preselectedCustomerId)
    } else {
      setCustomerId("new")
    }

    if (preselectedServiceId) {
      setServiceId(preselectedServiceId)
    } else {
      setServiceId("")
    }
  }, [
    open,
    preselectedDate,
    preselectedProfessionalId,
    preselectedCustomerId,
    preselectedServiceId,
    currentUser?.id,
    currentUser?.role,
    firstTeamMemberId,
    team
  ])

  const isWithinBusinessHours = (dateStr: string, timeStr: string) => {
    if (!settings) return true;

    const selectedDate = new Date(`${dateStr}T12:00:00`);
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

  const handlePreSubmit = (
    event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault()
    // 1. Validações Básicas
    if (!customerId && !customerName) {
      toast.error("Selecione um cliente existente ou digite o nome de um novo.")
      return
    }

    if (!date || !time || !selectedProfessionalId) {
      toast.error("Preencha data, horário e profissional.")
      return
    }

    // 2. Preparação dos Dados para Validação
    // Garante que 'date' seja um objeto Date real para pegar o dia da semana
    const dateObj = new Date(`${date}T12:00:00`)
    const dayOfWeek = dateObj.getDay()
    const timeStr = time.length === 5 ? time + ":00" : time

    // Encontra o profissional e a disponibilidade específica dele
    const professional = professionals?.find(p => p.id === selectedProfessionalId)
    const specificAvailability = professional?.professional_availability?.find(
      (a: any) => a.day_of_week === dayOfWeek && a.is_active
    )

    let isOutside = false

    // VERIFICAÇÃO DO PROFISSIONAL
    if (specificAvailability) {
        // Verifica turno do profissional
        const isOutsideProHours = 
        timeStr < specificAvailability.start_time || 
        timeStr >= specificAvailability.end_time

        // Verifica intervalo/pausa do profissional
        const isProLunchTime = 
        specificAvailability.break_start && specificAvailability.break_end &&
        timeStr >= specificAvailability.break_start && 
        timeStr < specificAvailability.break_end

        // 2. Verificação dos horários comerciais da organização
        if (isOutsideProHours || isProLunchTime) {
        isOutside = true
        } else {
        if (!isWithinBusinessHours(date, time)) {
            isOutside = true
        }
        }
    } else {
      isOutside = true
    }

    // 3. Decisão Final
    if (isOutside) {
      setShowOutsideHoursAlert(true)
      return
    }
    performSubmit()
  }

  async function performSubmit() {
    setShowOutsideHoursAlert(false);
    
    const finalCustomerName = customerId === 'new' ? customerName : customers.find(c => c.id === customerId)?.name
    
    if (!date || !time || !finalCustomerName || !selectedProfessionalId) {
      toast.error(`Preencha data, hora, ${cliente.toLowerCase()} e profissional.`)
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
            {actions.new || "Novo"} {agendamento}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {actions.new || "Novo"} {agendamento}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handlePreSubmit} className="space-y-4 py-2">

          {/* PROFISSIONAL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
              <User className="w-3 h-3" />
              {profissional}
            </Label>

            <Select
              value={selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
              disabled={currentUser?.role === 'professional'}
            >
              <SelectTrigger className="bg-muted/20">
                <SelectValue placeholder={`Selecione ${profissional.toLowerCase()}`} />
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

          {/* CLIENTE */}
          <div className="space-y-2">
            <Label>{cliente}</Label>

            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecione ou crie um ${cliente.toLowerCase()}`} />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="new" className="font-bold text-primary">
                  + Novo {cliente}
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
                  placeholder={`Nome do ${cliente.toLowerCase()}`}
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                />
                <Input
                  placeholder="Telefone / WhatsApp"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* SERVIÇO */}
          <div className="space-y-2">
            <Label>{servico}</Label>

            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder={`${servico} (opcional)`} />
              </SelectTrigger>

              <SelectContent>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      {s.color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                      )}
                      {s.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DATA / HORA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                {messages.date || "Data"}
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
                {messages.time || "Horário"}
              </Label>

              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="space-y-2">
            <Label>{messages.notes || "Observações"}</Label>

            <Textarea
              placeholder={messages.notes_placeholder || "Observações adicionais..."}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="resize-none"
            />
          </div>

          {/* BOTÃO */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={isLoading}
              className="w-full sm:w-auto"
              onClick={handlePreSubmit}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actions.confirm || "Confirmar"} {agendamento.toLowerCase()}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {/* ALERTA FORA DE HORÁRIO */}
    <AlertDialog open={showOutsideHoursAlert} onOpenChange={setShowOutsideHoursAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            {messages.outside_hours_title || "Fora do horário"}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {messages.outside_hours_desc ||
              `O horário selecionado (${time}) está fora do horário configurado.`}
            <br /><br />
            {actions.confirm_anyway || "Deseja continuar mesmo assim?"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            {actions.cancel || "Cancelar"}
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={() => performSubmit()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {actions.confirm || "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
)
}
