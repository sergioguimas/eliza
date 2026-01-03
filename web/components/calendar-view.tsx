'use client'

import { useState } from "react"
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays, 
  isToday, parseISO, startOfDay, addWeeks, subWeeks, getHours
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"

// Tipo alinhado com o Banco de Dados
type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string | null
  customers: { name: string } | any
  services: { title: string; color?: string } | any 
}

type Props = {
  appointments: Appointment[]
  customers: { id: string; name: string }[]
  services: { id: string; title: string }[] // Agora usa TITLE
  staff: { id: string; full_name: string }[] // Agora aceita STAFF
  organization_id: string
}

const getRawHour = (dateString: string) => {
  return new Date(dateString).getUTCHours();
};

export function CalendarView({ appointments, customers, services, staff, organization_id }: Props) {
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')

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
  
  function AppointmentCard({ appointment }: { appointment: Appointment }) {
    const status = appointment.status || 'scheduled'
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['scheduled']
    const serviceColor = appointment.services?.color || '#3b82f6'
    const isScheduled = status === 'scheduled'

    return (
      <AppointmentContextMenu appointment={appointment} className="h-full" customers={customers} services={services}>
        <div 
          className={cn(
            "px-2 py-1 rounded border text-[10px] md:text-xs font-medium h-full flex flex-col justify-center gap-0.5 transition-all hover:brightness-110 shadow-sm overflow-hidden text-zinc-200",
            !isScheduled && config.color
          )}
          style={isScheduled ? {
            backgroundColor: `${serviceColor}15`,
            borderLeft: `3px solid ${serviceColor}`,
            borderTop: `1px solid ${serviceColor}30`,
            borderRight: `1px solid ${serviceColor}30`,
            borderBottom: `1px solid ${serviceColor}30`,
          } : {}}
        >
          <div className="flex justify-between items-center w-full">
            <span className="truncate font-bold max-w-[85%]">
              {appointment.customers?.name || 'Sem nome'}
            </span>
            {!isScheduled && (
              <config.icon className="h-3 w-3 shrink-0 opacity-80" />
            )}
          </div>
          
          <div className="flex justify-between items-center opacity-70 text-[10px]">
            {/* CORREÇÃO: Usa title */}
            <span className="truncate max-w-[60%]">{appointment.services?.title}</span>
            <span>
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

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })
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
                const dayAppointments = appointments.filter(apt => 
                  isSameDay(parseISO(apt.start_time), day)
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
                      isToday(day) ? "bg-blue-600 text-white" : "text-zinc-400 group-hover:text-zinc-200"
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
            const hourAppointments = appointments.filter(apt => {
              const aptDate = new Date(apt.start_time);
              return isSameDay(aptDate, date) && getRawHour(apt.start_time) === hour;
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
        <div className="flex items-center gap-4">
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
          <h2 className="text-xl font-bold text-zinc-100 capitalize min-w-[200px]">
            {view === 'day' 
              ? format(date, "d 'de' MMMM", { locale: ptBR }) 
              : format(date, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[200px]">
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
            staff={staff} // Passando staff
            organization_id={organization_id} 
          />
        </div>
      </div>

      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}
    </div>
  )
}