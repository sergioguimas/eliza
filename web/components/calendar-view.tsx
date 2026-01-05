'use client'

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, isSameDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppointmentContextMenu } from "./appointment-context-menu"
import { STATUS_CONFIG } from "@/lib/appointment-config"

type Appointment = {
  id: string
  start_time: string
  end_time: string
  status: string
  customer: { name: string } | null
  service: { title: string }
  profile: { full_name: string } | null
}

type Props = {
  appointments?: Appointment[] // Opcional para evitar crash se vier undefined
  customers?: any[]
  services?: any[]
  staff?: any[]
  organization_id: string
}

export function CalendarView({ 
  appointments = [], // Valor padrão: lista vazia
  customers = [], 
  services = [], 
  staff = [], 
  organization_id 
}: Props) {
  // 1. Inicializa data
  const [date, setDate] = useState<Date>(new Date())
  
  // 2. Controle de montagem (Hydration)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Se não montou, esqueleto invisível
  if (!isMounted) {
    return (
      <div className="flex flex-col md:flex-row gap-6 opacity-0">
         <div className="w-full md:w-auto h-fit">Loading...</div>
      </div>
    )
  }

  // 3. SEGURANÇA EXTRA: Garante que appointments seja um array antes de filtrar
  const safeAppointments = Array.isArray(appointments) ? appointments : []

  const dailyAppointments = safeAppointments
    .filter(app => {
      if (!date || !app.start_time) return false
      const appDate = new Date(app.start_time)
      return isSameDay(appDate, date)
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Coluna da Esquerda: Calendário */}
      <Card className="w-full md:w-auto h-fit">
        <CardContent className="p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(day) => day && setDate(day)}
            locale={ptBR}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      {/* Coluna da Direita: Lista de Agendamentos */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <CreateAppointmentDialog 
            // 4. SEGURANÇA EXTRA: Passa arrays vazios se for null/undefined
            customers={Array.isArray(customers) ? customers : []}
            services={Array.isArray(services) ? services : []}
            staff={Array.isArray(staff) ? staff : []}
            organization_id={organization_id}
          />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="morning">Manhã</TabsTrigger>
              <TabsTrigger value="afternoon">Tarde</TabsTrigger>
            </TabsList>

            <div className="space-y-4">
              {dailyAppointments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum agendamento para este dia.
                </p>
              ) : (
                dailyAppointments.map((app) => {
                  const statusColor = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG] || "bg-gray-500"
                  
                  return (
                    <AppointmentContextMenu key={app.id} appointmentId={app.id}>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-12 rounded-full ${statusColor}`} />
                          <div>
                            <p className="font-medium text-lg">
                              {format(new Date(app.start_time), "HH:mm")} - {app.customer?.name || "Cliente sem nome"}
                            </p>
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              <span>{app.service.title}</span>
                              {app.profile && (
                                <>
                                  <span>•</span>
                                  <span>Dr(a). {app.profile.full_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-medium capitalize px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
                          {app.status === 'confirmed' ? 'Confirmado' : 
                           app.status === 'scheduled' ? 'Agendado' : app.status}
                        </div>
                      </div>
                    </AppointmentContextMenu>
                  )
                })
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}