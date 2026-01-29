'use client'

import { useState, useEffect, useMemo } from "react"
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays, 
  isToday, parseISO, addWeeks, subWeeks
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { 
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Filter, 
    CheckCircle2, Clock, XCircle, User, Plus 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { UpdateAppointmentDialog } from "@/components/update-appointment-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

// Paleta de cores
const PROFESSIONAL_COLORS = [
  { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },
  { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
  { bg: '#fae8ff', border: '#d946ef', text: '#86198f' },
  { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  { bg: '#ffedd5', border: '#f97316', text: '#9a3412' },
  { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e' },
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
  organization_id?: string
}

type Props = {
  appointments?: Appointment[]
  customers?: any[]
  services?: any[]
  staff?: any[]
  organization_id: string
  currentUser?: any
  settings?: any
}

const getRawHour = (dateString: string) => {
  if (!dateString) return 0;
  return new Date(dateString).getHours();
};

export function CalendarView({ 
  appointments = [], 
  customers = [], 
  services = [], 
  staff = [], 
  organization_id,
  currentUser,
  settings
}: Props) {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  
  // Estado para abrir o modal de edição
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  
  // Estado do Filtro
  const [filterId, setFilterId] = useState<string>('all')

  // Estado para abrir modal de criação pelo clique direito
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<Date | null>(null)

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
  
  function handleEventClick(e: React.MouseEvent, appointment: Appointment) {
    e.stopPropagation() 
    setSelectedAppointment(appointment)
    setIsUpdateOpen(true)
  }

  // --- FUNÇÃO PARA ABRIR O MODAL DE CRIAÇÃO VIA CLIQUE DIREITO ---
  function openCreateModal(targetDate: Date) {
      setCreateDate(targetDate)
      setIsCreateOpen(true)
  }

  // --- COMPONENTE DO CARD ---
  function AppointmentCard({ appointment }: { appointment: Appointment }) {
    const status = appointment.status || 'scheduled'
    const isPanorama = filterId === 'all'
    
    let styles = {
        bg: '#e0f2fe',
        border: '#0ea5e9',
        text: '#0369a1',
        icon: CalendarIcon
    }

    if (status === 'confirmed') {
        styles = { bg: '#dcfce7', border: '#16a34a', text: '#14532d', icon: CheckCircle2 }
    } else if (status === 'pending') {
        styles = { bg: '#fef9c3', border: '#ca8a04', text: '#713f12', icon: Clock }
    } else if (status === 'canceled') {
        styles = { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d', icon: XCircle }
    } else {
        if (isPanorama && appointment.professional_id) {
            styles = { ...styles, ...getProfessionalColor(appointment.professional_id), icon: User }
        }
    }

    return (
      <AppointmentContextMenu appointment={appointment}>
        <div 
          onClick={(e) => handleEventClick(e, appointment)}
          className={cn(
            "px-2 py-1 rounded border text-[10px] md:text-xs font-medium h-full flex flex-col justify-center gap-0.5 transition-all hover:brightness-95 shadow-sm overflow-hidden cursor-pointer relative",
            status === 'canceled' && "opacity-70 grayscale"
          )}
          style={{
            backgroundColor: styles.bg,
            borderLeft: `3px solid ${styles.border}`,
            color: styles.text
          }}
        >
          <div className="flex justify-between items-start w-full gap-1">
            <span className={cn("truncate font-bold leading-tight", status === 'canceled' && "line-through")}>
              {appointment.customers?.name || 'Sem nome'}
            </span>
            <styles.icon className="h-3 w-3 shrink-0 opacity-70 mt-0.5" />
          </div>
          
          <div className="flex justify-between items-center opacity-85 text-[10px] gap-2">
            <div className="truncate flex items-center gap-1">
                <span className="font-semibold tracking-tight truncate">
                   {isPanorama && appointment.profiles?.full_name 
                      ? appointment.profiles.full_name.split(' ')[0] 
                      : appointment.services?.title || "Consulta"
                   }
                </span>
            </div>
            <span className="whitespace-nowrap font-mono text-[9px] opacity-100 font-bold">
              {new Date(appointment.start_time).toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit'
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
                  <ContextMenu key={j}>
                    <ContextMenuTrigger className="h-full w-full">
                        <div 
                            className={cn(
                            "h-full w-full border-r border-b border-zinc-800/50 p-1 md:p-2 min-h-[80px] relative hover:bg-zinc-800/30 transition-colors group flex flex-col gap-1",
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
                    </ContextMenuTrigger>
                    
                    <ContextMenuContent className="w-48">
                         <ContextMenuItem onClick={() => openCreateModal(day)}>
                             <Plus className="mr-2 h-4 w-4" />
                             Agendar neste dia
                         </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderDayView() {
    const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 as 22:00

    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col h-[700px]">
        <div className="flex-1 overflow-y-auto">
          {hours.map(hour => {
            const hourAppointments = filteredAppointments.filter(apt => {
              if (!apt.start_time) return false;
              const aptDate = new Date(apt.start_time);
              return isSameDay(aptDate, date) && getRawHour(apt.start_time) === hour && apt.status !== 'canceled';
            });

            const slotDate = new Date(date)
            slotDate.setHours(hour, 0, 0, 0)

            return (
              <ContextMenu key={hour}>
                <ContextMenuTrigger>
                    <div className="grid grid-cols-[60px_1fr] min-h-[100px] border-b border-zinc-800/50 group hover:bg-zinc-800/20 cursor-context-menu">
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
                </ContextMenuTrigger>
                
                <ContextMenuContent className="w-52">
                    <ContextMenuItem onClick={() => openCreateModal(slotDate)}>
                        <Clock className="mr-2 h-4 w-4" />
                        Agendar às {hour}:00
                    </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CABEÇALHO */}
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
            preselectedProfessionalId={filterId} 
            settings={settings}
          />
        </div>
      </div>

      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}

      {/* LEGENDA */}
      <div className="flex flex-wrap items-center gap-6 p-4 rounded-md border border-zinc-800 bg-zinc-900/50 text-xs">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">Legenda:</span>
          
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#fef9c3] border border-[#ca8a04]"></div>
              <span className="text-zinc-300">Pendente</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#dcfce7] border border-[#16a34a]"></div>
              <span className="text-zinc-300">Confirmado</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#e0f2fe] border border-[#0ea5e9]"></div>
              <span className="text-zinc-300">Agendado</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#fee2e2] border border-[#ef4444]"></div>
              <span className="text-zinc-300">Cancelado</span>
          </div>
      </div>

      <UpdateAppointmentDialog
        appointment={selectedAppointment}
        open={isUpdateOpen}
        onOpenChange={setIsUpdateOpen}
        professionals={staff}
        services={services}
        currentUser={currentUser}
        settings={settings}
      />

      <CreateAppointmentDialog 
        customers={customers} 
        services={services} 
        professionals={staff}
        organization_id={organization_id} 
        currentUser={currentUser}
        
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        preselectedDate={createDate}
        preselectedProfessionalId={filterId}
        settings={settings}
      />

    </div>
  )
}