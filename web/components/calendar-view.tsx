'use client'

import { useState, useEffect, useMemo } from "react"
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays, 
  isToday, parseISO, addWeeks, subWeeks
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Filter, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { UpdateAppointmentDialog } from "@/components/update-appointment-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Paleta de cores suaves para os médicos
const PROFESSIONAL_COLORS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a' }, // Azul
  { bg: '#dcfce7', border: '#22c55e', text: '#14532d' }, // Verde
  { bg: '#fce7f3', border: '#ec4899', text: '#831843' }, // Rosa
  { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' }, // Roxo
  { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' }, // Laranja
  { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' }, // Teal
]

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  professional_id?: string
  service_id?: string
  notes?: string
  customers: { id: string; name: string } | null
  services: { id: string; title: string; color?: string } | null
  profiles?: { id: string; full_name: string } | null
}

type Props = {
  appointments?: Appointment[]
  customers?: any[]
  services?: any[]
  staff?: any[]
  organization_id: string
  currentUser?: any
}

const getRawHour = (dateString: string) => {
  if (!dateString) return 0;
  return new Date(dateString).getUTCHours();
};

export function CalendarView({ 
  appointments = [], 
  customers = [], 
  services = [], 
  staff = [], 
  organization_id,
  currentUser
}: Props) {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  
  // Estado para abrir o modal de edição
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  
  // Estado do Filtro
  const [filterId, setFilterId] = useState<string>('all')

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
    if (currentUser?.role === 'professional' && currentUser?.id) {
        setFilterId(currentUser.id)
    }
  }, [currentUser])

  const getProfessionalColor = (profId?: string) => {
    if (!profId) return PROFESSIONAL_COLORS[0]
    const index = profId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length]
  }

  const filteredAppointments = useMemo(() => {
    if (filterId === 'all') return appointments
    return appointments.filter(apt => apt.professional_id === filterId)
  }, [appointments, filterId])

  if (!isMounted) {
    return (
      <div className="flex h-[600px] items-center justify-center border rounded-md bg-zinc-900">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  function next() {
    if (view === 'month') setDate(addMonths(date, 1))
    else if (view === 'week') setDate(addWeeks(date, 1))
    else setDate(addDays(date, 1))
  }

  function previous() {
    if (view === 'month') setDate(subMonths(date, 1))
    else if (view === 'week') setDate(subWeeks(date, 1))
    else setDate(subDays(date, 1))
  }

  function today() {
    setDate(new Date())
  }
  
  // === FUNÇÃO PARA ABRIR O UPDATE ===
  function handleEventClick(e: React.MouseEvent, appointment: Appointment) {
    e.stopPropagation() // Evita bugs de clique
    setSelectedAppointment(appointment)
    setIsUpdateOpen(true)
  }

  function AppointmentCard({ appointment }: { appointment: Appointment }) {
    const status = appointment.status || 'scheduled'
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['scheduled']
    const isScheduled = status === 'scheduled'
    const isPanorama = filterId === 'all'
    
    let cardStyle = {}
    let profColors = null

    if (isScheduled) {
        if (isPanorama && appointment.professional_id) {
            profColors = getProfessionalColor(appointment.professional_id)
            cardStyle = {
                backgroundColor: profColors.bg,
                borderLeft: `3px solid ${profColors.border}`,
                color: profColors.text
            }
        } else {
            const serviceColor = appointment.services?.color || '#3b82f6'
            cardStyle = {
                backgroundColor: `${serviceColor}15`,
                borderLeft: `3px solid ${serviceColor}`,
                color: '#e4e4e7'
            }
        }
    } else {
       cardStyle = {
         color: config.color ? config.color.replace('text-', '') : undefined 
       }
    }

    return (
      <AppointmentContextMenu appointmentId={appointment.id}>
        <div 
          onClick={(e) => handleEventClick(e, appointment)}
          className={cn(
            "px-2 py-1 rounded border text-[10px] md:text-xs font-medium h-full flex flex-col justify-center gap-0.5 transition-all hover:brightness-95 shadow-sm overflow-hidden cursor-pointer",
            !isScheduled && "bg-zinc-800 border-zinc-700"
          )}
          style={cardStyle}
        >
          <div className="flex justify-between items-center w-full">
            <span className="truncate font-bold max-w-[90%] leading-tight">
              {appointment.customers?.name || 'Sem nome'}
            </span>
            {!isScheduled && (
              <config.icon className="h-3 w-3 shrink-0 opacity-80" />
            )}
          </div>
          
          <div className="flex justify-between items-center opacity-80 text-[10px] gap-2">
            <div className="truncate flex items-center gap-1">
                {isPanorama && appointment.profiles?.full_name ? (
                     <span className="uppercase font-bold tracking-tighter opacity-75">
                        {appointment.profiles.full_name.split(' ')[0]}
                     </span>
                ) : (
                    <span>{appointment.services?.title || "Serviço"}</span>
                )}
            </div>
            
            <span className="whitespace-nowrap font-mono text-[9px]">
              {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'UTC' 
              })}
            </span>
          </div>
        </div>
      </AppointmentContextMenu>
    )
  }

  function renderMonthView() {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const weeks = []
    let days = []
    let day = startDate

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        days.push(day)
        day = addDays(day, 1)
      }
      weeks.push(days)
      days = []
    }

    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName) => (
            <div key={dayName} className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {dayName}
            </div>
          ))}
        </div>
        
        <div className="grid grid-rows-5 md:grid-rows-6 h-[600px] md:h-[700px]">
          {weeks.map((week, i) => (
            <div key={i} className="grid grid-cols-7">
              {week.map((day, j) => {
                const dayAppointments = filteredAppointments.filter(apt => 
                  apt.start_time &&
                  isSameDay(parseISO(apt.start_time), day) &&
                  apt.status !== 'canceled'
                ).sort((a, b) => a.start_time.localeCompare(b.start_time))

                return (
                  <div 
                    key={j} 
                    className={cn(
                      "border-r border-b border-zinc-800/50 p-1 md:p-2 min-h-[80px] relative hover:bg-zinc-800/30 transition-colors group flex flex-col gap-1",
                      !isSameMonth(day, monthStart) && "bg-zinc-950/30 opacity-40",
                      isToday(day) && "bg-zinc-900"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                      isToday(day) ? "bg-primary text-primary-foreground" : "text-zinc-400 group-hover:text-zinc-200"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[100px] no-scrollbar">
                      {dayAppointments.map(apt => (
                        <div key={apt.id} className="h-auto">
                           <AppointmentCard appointment={apt} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderDayView() {
    const hours = Array.from({ length: 14 }, (_, i) => i + 7);

    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col h-[700px]">
        <div className="flex-1 overflow-y-auto">
          {hours.map(hour => {
            const hourAppointments = filteredAppointments.filter(apt => {
              if (!apt.start_time) return false;
              const aptDate = new Date(apt.start_time);
              return isSameDay(aptDate, date) && getRawHour(apt.start_time) === hour && apt.status !== 'canceled';
            });

            return (
              <div key={hour} className="grid grid-cols-[60px_1fr] min-h-[100px] border-b border-zinc-800/50 group hover:bg-zinc-800/20">
                <div className="border-r border-zinc-800/50 p-2 text-right">
                  <span className="text-xs text-zinc-500 font-medium">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
                
                <div className="p-1 md:p-2 relative flex gap-2 overflow-x-auto">
                  {hourAppointments.map(apt => (
                    <div key={apt.id} className="flex-1 min-w-[150px] max-w-[250px]">
                      <AppointmentCard appointment={apt} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900 p-1">
            <Button variant="ghost" size="icon" onClick={previous} className="h-8 w-8 text-zinc-400">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={today} className="h-8 w-8 text-zinc-400">
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 text-zinc-400">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-xl font-bold text-zinc-100 capitalize min-w-[150px]">
            {view === 'day' 
              ? format(date, "d 'de' MMMM", { locale: ptBR }) 
              : format(date, 'MMMM yyyy', { locale: ptBR })}
          </h2>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                <Select value={filterId} onValueChange={setFilterId}>
                    <SelectTrigger className="w-[180px] h-7 border-0 bg-transparent focus:ring-0 p-0 text-xs text-zinc-200">
                        <SelectValue placeholder="Todos os profissionais" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                            <span className="font-semibold">Todos (Panorama)</span>
                        </SelectItem>
                        {staff.map(prof => (
                            <SelectItem key={prof.id} value={prof.id}>
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: getProfessionalColor(prof.id).border }} 
                                    />
                                    {prof.full_name}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[180px]">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-950">
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week" disabled className="opacity-50">Sem</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="h-6 w-px bg-zinc-800 mx-2 hidden md:block" />
          
          <CreateAppointmentDialog 
            customers={customers} 
            services={services} 
            professionals={staff}
            organization_id={organization_id} 
            preselectedDate={date}
            currentUser={currentUser}
          />
        </div>
      </div>

      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}

      <UpdateAppointmentDialog
        appointment={selectedAppointment}
        open={isUpdateOpen}
        onOpenChange={setIsUpdateOpen}
        professionals={staff}
        services={services}
        currentUser={currentUser}
      />
    </div>
  )
}