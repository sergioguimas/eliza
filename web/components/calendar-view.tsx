'use client'

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Calendar as CalendarIcon, CalendarDays, LayoutGrid, Clock, User } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function CalendarView({ appointments }: { appointments: any[] }) {
  const [view, setView] = useState("month")

  return (
    <Tabs defaultValue="month" className="w-full" onValueChange={setView}>
      <div className="flex justify-end mb-6">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
          <TabsTrigger value="month" className="gap-2 data-[state=active]:bg-zinc-800">
            <LayoutGrid className="h-4 w-4" /> Mês
          </TabsTrigger>
          <TabsTrigger value="day" className="gap-2 data-[state=active]:bg-zinc-800">
            <CalendarDays className="h-4 w-4" /> Dia
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="month" className="mt-0 outline-none">
        <Card className="bg-zinc-900/40 border-zinc-800 min-h-[600px]">
          <CardContent className="p-0">
            {/* Aqui desenhamos a grade do mês de forma simplificada */}
            <div className="grid grid-cols-7 border-b border-zinc-800">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                <div key={dia} className="py-3 text-center text-xs font-semibold text-zinc-500 uppercase border-r border-zinc-800 last:border-0">
                  {dia}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[120px]">
               {/* Simulação de dias do mês */}
               {Array.from({ length: 31 }).map((_, i) => (
                 <div key={i} className="p-2 border-r border-b border-zinc-800 text-zinc-600 text-xs hover:bg-zinc-800/20 transition-colors">
                   <span className="mb-1 block">{i + 1}</span>
                   {/* Mostra bolinha se houver agendamento no dia (lógica simplificada) */}
                   {appointments.some(a => new Date(a.start_time).getDate() === i + 1) && (
                     <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mx-auto mt-1" />
                   )}
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="day" className="mt-0 outline-none">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-200">Cronograma Diário</h3>
          <div className="grid gap-3">
            {appointments.length > 0 ? (
              appointments.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()).map(app => (
                <Card key={app.id} className="bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-all">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center border-r border-zinc-800 pr-6">
                        <span className="text-blue-500 font-bold text-lg leading-none">
                          {new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Clock className="h-3 w-3 text-zinc-600 mt-1" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-zinc-500" />
                          <p className="font-bold text-zinc-100">{app.customers?.full_name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: app.services?.color || '#3b82f6' }} />
                          <p className="text-xs text-zinc-400">{app.services?.name}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] uppercase font-bold px-2 py-1 rounded",
                        app.status === 'scheduled' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {app.status === 'scheduled' ? 'Confirmado' : app.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl">
                <CalendarIcon className="h-12 w-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500">Nenhum agendamento para este período.</p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}