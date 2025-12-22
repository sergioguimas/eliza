'use client'

import { useState } from "react"
import { 
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays, 
  isToday, parseISO, startOfDay, addWeeks, subWeeks, getHours
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  customers: { name: string } | null
  services: { title: string; color?: string } | null
}

type Props = {
  appointments: Appointment[]
  customers: { id: string; name: string }[]
  services: { id: string; title: string; price: number | null }[]
}

export function CalendarView({ appointments, customers, services }: Props) {
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

  // --- COMPONENTE DO CARD DE AGENDAMENTO (Reutilizável) ---
  function AppointmentCard({ appointment }: { appointment: Appointment }) {
    const status = appointment.status || 'scheduled'
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['scheduled']
    const serviceColor = appointment.services?.color || '#3b82f6'
    
    // Lógica de Estilo:
    // Se estiver "Agendado", usa a cor do serviço para diferenciar o tipo de atendimento.
    // Se estiver em outro status (Chegou, Atendendo), usa a cor do status para chamar atenção.
    const isScheduled = status === 'scheduled'

    return (
      <AppointmentContextMenu appointment={appointment} className="h-full" customers={customers} services={services}>
        <div 
          className={cn(
            "px-2 py-1 rounded border text-[10px] md:text-xs font-medium h-full flex flex-col justify-center gap-0.5 transition-all hover:brightness-110 shadow-sm overflow-hidden",
            // Se não for agendado, aplica as classes de cor do status (bg/border/text) definidas no config
            !isScheduled && config.color
          )}
          style={isScheduled ? {
            backgroundColor: `${serviceColor}15`, // 10-15% opacidade
            borderLeft: `3px solid ${serviceColor}`,
            borderTop: `1px solid ${serviceColor}30`,
            borderRight: `1px solid ${serviceColor}30`,
            borderBottom: `1px solid ${serviceColor}30`,
            color: '#e4e4e7' // text-zinc-200
          } : {}}
        >
          <div className="flex justify-between items-center w-full">
            <span className="truncate font-bold max-w-[85%]">
              {appointment.customers?.name || 'Sem nome'}
            </span>
            {/* Ícone do Status (só aparece se não for agendado normal) */}
            {!isScheduled && (
              <config.icon className="h-3 w-3 shrink-0 opacity-80" />
            )}
          </div>
          
          <div className="flex justify-between items-center opacity-70 text-[10px]">
            <span className="truncate max-w-[60%]">{appointment.services?.title}</span>
            <span>
              {format(parseISO(appointment.start_time), 'HH:mm')}
            </span>
          </div>
        </div>
      </AppointmentContextMenu>
    )
  }

  // --- RENDERIZAÇÃO MENSAL ---
  function renderMonthView() {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    })

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
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName) => (
            <div key={dayName} className="py-2 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              {dayName}
            </div>
          ))}
        </div>
        
        {/* Grade do Calendário */}
        <div className="grid grid-rows-5 md:grid-rows-6 h-[600px] md:h-[700px]">
          {weeks.map((week, i) => (
            <div key={i} className="grid grid-cols-7">
              {week.map((day, j) => {
                const dayAppointments = appointments.filter(apt => 
                  isSameDay(parseISO(apt.start_time), day)
                ).sort((a, b) => a.start_time.localeCompare(b.start_time)) // Ordena por horário

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
                      isToday(day) 
                        ? "bg-blue-600 text-white" 
                        : "text-zinc-400 group-hover:text-zinc-200"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {/* Lista de Agendamentos do Dia */}
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

  // --- RENDERIZAÇÃO DIÁRIA ---
  function renderDayView() {
    const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 07:00 as 20:00

    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col h-[700px]">
         <div className="flex-1 overflow-y-auto">
            {hours.map(hour => {
              const currentHour = new Date(date)
              currentHour.setHours(hour, 0, 0, 0)

              // Pega agendamentos que começam nesta hora
              const hourAppointments = appointments.filter(apt => {
                const aptDate = parseISO(apt.start_time)
                return isSameDay(aptDate, date) && getHours(aptDate) === hour
              })

              return (
                <div key={hour} className="grid grid-cols-[60px_1fr] min-h-[100px] border-b border-zinc-800/50 group hover:bg-zinc-800/20">
                  {/* Coluna da Hora */}
                  <div className="border-r border-zinc-800/50 p-2 text-right">
                    <span className="text-xs text-zinc-500 font-medium">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                  
                  {/* Coluna dos Eventos */}
                  <div className="p-1 md:p-2 relative flex gap-2 overflow-x-auto">
                    {/* Linha guia do tempo atual se for hoje */}
                    {isToday(date) && hour === new Date().getHours() && (
                      <div 
                        className="absolute w-full h-px bg-red-500 z-10 pointer-events-none opacity-50"
                        style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }}
                      >
                         <div className="w-2 h-2 bg-red-500 rounded-full -mt-1 -ml-1 absolute" />
                      </div>
                    )}

                    {hourAppointments.map(apt => (
                      <div key={apt.id} className="flex-1 min-w-[150px] max-w-[250px]">
                        <AppointmentCard appointment={apt} />
                      </div>
                    ))}
                    
                    {/* Placeholder se vazio para facilitar clique de "Novo" */}
                    {hourAppointments.length === 0 && (
                      <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs text-zinc-600 border border-dashed border-zinc-700 rounded px-2 py-1 select-none">
                          Livre
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
         </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho e Controles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900 p-1">
            <Button variant="ghost" size="icon" onClick={previous} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={today} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={next} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-xl font-bold text-zinc-100 capitalize min-w-[200px]">
            {view === 'day' 
              ? format(date, "d 'de' MMMM", { locale: ptBR }) 
              : format(date, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>

        {/* Controles de Visualização */}
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-950">
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="week" disabled className="opacity-50 cursor-not-allowed" title="Em breve">Sem</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="h-6 w-px bg-zinc-800 mx-2 hidden md:block" />
          <CreateAppointmentDialog customers={customers} services={services} />
        </div>
      </div>

      {/* Renderização Condicional */}
      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}
    </div>
  )
}