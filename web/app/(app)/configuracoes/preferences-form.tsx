'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, MessageSquare, Save, Loader2 } from "lucide-react"
import { updatePreferences } from "@/app/actions/update-preferences"
import { toast } from "sonner"

export function PreferencesForm({ settings, organizationId }: { settings: any, organizationId: string }) {
  const [isPending, startTransition] = useTransition()

  const daysMap = [
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
    { id: 0, label: 'Domingo' },
  ]

  async function handleSubmit(formData: FormData) {
      startTransition(async () => {
        const result = await updatePreferences(formData)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success("Configurações salvas com sucesso!")
        }
      })
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="horarios" className="w-full">
        {/* LISTA DE ABAS (Fora do Cartão) */}
        <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="horarios" className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Horários
            </TabsTrigger>
            <TabsTrigger value="mensagens" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Mensagens
            </TabsTrigger>
        </TabsList>

        {/* --- ABA 1: HORÁRIOS --- */}
        <TabsContent value="horarios">
          <form action={handleSubmit}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="form_type" value="schedule" />

              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle>Horários de Funcionamento</CardTitle>
                    <CardDescription>Defina a disponibilidade da agenda para os pacientes.</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Abertura</Label>
                      <Input type="time" name="open_hours_start" defaultValue={settings?.open_hours_start || "08:00"} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fechamento</Label>
                      <Input type="time" name="open_hours_end" defaultValue={settings?.open_hours_end || "18:00"} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração Padrão (minutos)</Label>
                    <Input type="number" name="appointment_duration" defaultValue={settings?.appointment_duration || 30} />
                  </div>

                  <div className="space-y-3">
                    <Label>Dias de Atendimento</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {daysMap.map((day) => (
                        <div key={day.id} className="flex items-center space-x-2">
                          <Checkbox 
                            name="days_of_week" 
                            value={day.id.toString()} 
                            defaultChecked={settings?.days_of_week?.includes(day.id)}
                          />
                          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                
                <div className="flex justify-end p-6 pt-0 border-t mt-4 pt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Horários
                  </Button>
                </div>
              </Card>
          </form>
        </TabsContent>

        {/* --- ABA 2: MENSAGENS --- */}
        <TabsContent value="mensagens">
          <form action={handleSubmit}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="form_type" value="messages" />

              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle>Mensagens do Robô</CardTitle>
                    <CardDescription>Personalize os textos enviados automaticamente pelo WhatsApp.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-green-600">Ao Confirmar Agendamento</Label>
                    <Textarea 
                      name="msg_appointment_created" 
                      defaultValue={settings?.msg_appointment_created || "Olá {name}, seu agendamento de {service} foi confirmado para {date} às {time} com {professional}."}
                      rows={3} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-blue-600">Lembrete (Dia Anterior)</Label>
                    <Textarea 
                      name="msg_appointment_reminder" 
                      defaultValue={settings?.msg_appointment_reminder || "Olá {name}, lembrete do seu agendamento amanhã às {time}. Confirma?"}
                      rows={3} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-red-600">Ao Cancelar</Label>
                    <Textarea 
                      name="msg_appointment_canceled" 
                      defaultValue={settings?.msg_appointment_canceled || "Olá {name}, seu agendamento foi cancelado."} 
                      rows={3} 
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-900 p-3 rounded-md border border-zinc-100 dark:border-zinc-800">
                     <strong>Variáveis disponíveis:</strong> {'{name}'} (Nome do Paciente), {'{date}'} (Data), {'{time}'} (Horário), {'{service}'} (Nome do Serviço).
                  </div>
                </CardContent>

                <div className="flex justify-end p-6 pt-0 border-t mt-4 pt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Mensagens
                  </Button>
                </div>
              </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  )
}