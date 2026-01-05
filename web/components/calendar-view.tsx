'use client'

import { useState, useEffect } from "react"
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isValid 
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  customer: { name: string } | null
  service: { title: string } | null
  profile: { full_name: string } | null
}

type Props = {
  appointments?: Appointment[]
  customers?: any[]
  services?: any[]
  staff?: any[]
  organization_id: string
}

export function CalendarView({ 
  appointments = [], 
  customers = [], 
  services = [], 
  staff = [], 
  organization_id 
}: Props) {
  // Estado da data focada (Mês que estamos vendo)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="p-8 text-center text-muted-foreground">Carregando calendário...</div>
  }

  // --- LÓGICA DO GRID DO MÊS ---
  // 1. Pega o primeiro dia da grade (pode ser do mês anterior para completar a semana)
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { locale: ptBR })
  const endDate = endOfWeek(monthEnd, { locale: ptBR })

  // 2. Gera todos os dias que vão aparecer na tela
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  })

  // 3. Dias da semana para o cabeçalho (Dom, Seg, Ter...)
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const safeAppointments = Array.isArray(appointments) ? appointments : []

  function nextMonth() {
    setCurrentDate(addMonths(currentDate, 1))
  }

  function prevMonth() {
    setCurrentDate(subMonths(currentDate, 1))
  }

  function jumpToToday() {
    setCurrentDate(new Date())
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 pb-4">
        
        {/* Controles de Navegação */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-secondary rounded-md border">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <CardTitle className="text-xl font-bold capitalize">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </div>

        {/* Botões da Direita */}
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={jumpToToday}>Hoje</Button>
            <CreateAppointmentDialog 
                customers={Array.isArray(customers) ? customers : []}
                services={Array.isArray(services) ? services : []}
                staff={Array.isArray(staff) ? staff : []}
                organization_id={organization_id}
            />
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-[600px]">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center py-2 text-sm font-semibold text-muted-foreground">
          {weekDays.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Grade de Dias */}
        <div className="grid grid-cols-7 auto-rows-fr h-full">
          {calendarDays.map((day, idx) => {
            // Filtra agendamentos deste dia específico
            const dayAppointments = safeAppointments.filter(app => {
                const appTime = new Date(app.start_time)
                return isValid(appTime) && isSameDay(appTime, day)
            }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = isSameDay(day, new Date())

            return (
              <div 
                key={day.toISOString()} 
                className={`
                  min-h-[100px] p-2 border-b border-r relative flex flex-col gap-1
                  ${!isCurrentMonth ? 'bg-muted/20 text-muted-foreground' : 'bg-background'}
                  ${idx % 7 === 0 ? 'border-l' : ''} /* Borda esquerda no domingo */
                `}
              >
                {/* Número do Dia */}
                <div className={`
                  text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1
                  ${isToday ? 'bg-primary text-primary-foreground' : ''}
                `}>
                  {format(day, 'd')}
                </div>

                {/* Lista de Agendamentos do Dia (Chips) */}
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[120px]">
                  {dayAppointments.map(app => {
                    const statusColor = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || "bg-gray-500"
                    
                    return (
                        <AppointmentContextMenu key={app.id} appointmentId={app.id}>
                          <div className={`
                            text-xs p-1.5 rounded-md border shadow-sm cursor-pointer hover:opacity-80 transition-opacity truncate
                            flex items-center gap-2 bg-card
                          `}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                            <span className="font-semibold">{format(new Date(app.start_time), "HH:mm")}</span>
                            <span className="truncate">{app.customer?.name || "Sem nome"}</span>
                          </div>
                        </AppointmentContextMenu>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}