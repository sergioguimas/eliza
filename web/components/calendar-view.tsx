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

  // --- Funções de Navegação ---
  const navigate = (direction: 'prev' | 'next') => {
    if (view === 'month') {
      setDate(direction === 'next' ? addMonths(date, 1) : subMonths(date, 1))
    } else if (view === 'week') {
      setDate(direction === 'next' ? addWeeks(date, 1) : subWeeks(date, 1))
    } else {
      setDate(direction === 'next' ? addDays(date, 1) : subDays(date, 1))
    }
  }

  const handleDayClick = (day: Date) => {
    setDate(day)
    setView('day')
  }

  // --- Renderizadores ---

  // 1. Visão Mensal (Simples e Resumida)
  const renderMonthView = () => {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

    return (
      <div className="grid grid-cols-7 gap-px bg-zinc-800 rounded-b-lg overflow-hidden border border-t-0 border-zinc-800">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => (
          <div key={d} className="bg-zinc-900 py-2 text-center text-xs font-medium text-zinc-500">{d}</div>
        ))}
        {calendarDays.map((day) => {
          const dayAppts = appointments.filter(a => isSameDay(parseISO(a.start_time), day))
          dayAppts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

          return (
            <div 
              key={day.toString()} 
              onClick={() => handleDayClick(day)}
              className={cn(
                "min-h-[100px] bg-zinc-950 p-1 hover:bg-zinc-900 cursor-pointer transition-colors flex flex-col gap-1",
                !isSameMonth(day, monthStart) && "opacity-30"
              )}
            >
              <span className={cn(
                "w-6 h-6 flex items-center justify-center rounded-full text-sm",
                isToday(day) ? "bg-blue-600 text-white" : "text-zinc-400"
              )}>
                {format(day, 'd')}
              </span>
              
              <div className="flex flex-col gap-1">
                {dayAppts.slice(0, 3).map(appt => (
                  <div 
                    key={appt.id} 
                    className="text-[10px] px-1 py-0.5 rounded truncate font-medium text-white/90"
                    style={{ backgroundColor: appt.services?.color || '#3b82f6' }}
                  >
                    {format(parseISO(appt.start_time), 'HH:mm')} {appt.customers?.name}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <span className="text-[10px] text-zinc-500 pl-1">+ {dayAppts.length - 3} mais</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // 2. Visão Diária (Timeline Detalhada)
  const renderDayView = () => {
    // Horários das 07:00 as 20:00
    const hours = Array.from({ length: 14 }, (_, i) => i + 7) 
    const dayAppts = appointments.filter(a => isSameDay(parseISO(a.start_time), date))

    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-b-lg overflow-hidden flex flex-col h-[600px] overflow-y-auto relative">
        {hours.map(hour => (
          <div key={hour} className="group flex border-b border-zinc-800/50 min-h-[60px] relative">
            {/* Coluna da Hora */}
            <div className="w-16 flex-shrink-0 text-xs text-zinc-500 py-2 text-center border-r border-zinc-800/50 bg-zinc-900/30 group-hover:bg-zinc-900/50">
              {hour}:00
            </div>
            
            {/* Área de Conteúdo */}
            <div className="flex-1 relative group-hover:bg-zinc-900/10 transition-colors">
              {/* Renderiza agendamentos que começam nesta hora */}
              {dayAppts.filter(a => getHours(parseISO(a.start_time)) === hour).map(appt => {
                const start = parseISO(appt.start_time)
                const end = parseISO(appt.end_time)
                const durationMinutes = (end.getTime() - start.getTime()) / 60000
                const topOffset = (start.getMinutes() / 60) * 100 // % de topo

                return (
                  <div
                    key={appt.id}
                    className="absolute left-1 right-1 rounded px-2 py-1 text-xs border-l-4 shadow-sm z-10 flex flex-col justify-center"
                    style={{
                      top: `${topOffset}%`,
                      height: `${Math.max(durationMinutes, 45)}px`, // Altura baseada na duração (min 45px visual)
                      backgroundColor: `${appt.services?.color}20` || '#3b82f620', // Cor com transparência
                      borderLeftColor: appt.services?.color || '#3b82f6',
                      color: '#e4e4e7'
                    }}
                  >
                    <span className="font-bold">
                      {format(start, 'HH:mm')} - {appt.services?.title}
                    </span>
                    <span className="opacity-80 truncate">{appt.customers?.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra de Controle Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-4 rounded-t-lg border border-zinc-800 border-b-0">
        
        {/* Navegação e Título */}
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-950">
            <Button variant="ghost" size="icon" onClick={() => navigate('prev')} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('next')} className="h-8 w-8 text-zinc-400 hover:text-zinc-100">
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

      {/* Área do Calendário Dinâmica */}
      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}
      
      {/* Legenda (Opcional) */}
      {view === 'month' && (
        <div className="text-xs text-zinc-500 flex gap-4 mt-2">
          <p>💡 Clique em um dia para ver os horários detalhados.</p>
        </div>
      )}
    </div>
  )
}