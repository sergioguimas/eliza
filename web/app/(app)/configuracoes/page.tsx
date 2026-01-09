import { createClient } from "@/utils/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
// AQUI: Importamos a nova ação separada
import { updatePreferences } from "@/app/actions/update-preferences"
import { MessageSquare, Clock, Save, Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user?.id || '').single()
  
  // Busca as configurações operacionais (pode não existir ainda se for nova org)
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', profile?.organization_id || '')
    .single()

  if (!settings) return <div className="p-8">Carregando configurações... (Se travar, recarregue a página)</div>

  const daysMap = [
    { id: 0, label: 'Domingo' },
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
  ]

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie os horários e as mensagens automáticas da clínica.</p>
      </div>

      {/* AQUI: O formulário aponta para updatePreferences */}
      <form action={async (formData) => {
        "use server"
        await updatePreferences(formData)
      }}>
        <input type="hidden" name="organization_id" value={profile?.organization_id || ''} />
        
        <Tabs defaultValue="horarios" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="horarios">Horários & Agenda</TabsTrigger>
            <TabsTrigger value="mensagens">Mensagens Automáticas</TabsTrigger>
          </TabsList>

          {/* ABA HORÁRIOS */}
          <TabsContent value="horarios" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5"/> Funcionamento</CardTitle>
                <CardDescription>Defina os dias e horários que a clínica está aberta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="open_hours_start">Abertura</Label>
                    <Input type="time" id="open_hours_start" name="open_hours_start" defaultValue={settings.open_hours_start || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="open_hours_end">Fechamento</Label>
                    <Input type="time" id="open_hours_end" name="open_hours_end" defaultValue={settings.open_hours_end || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duração Padrão do Atendimento (minutos)</Label>
                  <Input type="number" name="appointment_duration" defaultValue={settings.appointment_duration || ''} />
                </div>

                <div className="space-y-3">
                  <Label>Dias de Funcionamento</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {daysMap.map((day) => (
                      <div key={day.id} className="flex items-center space-x-2 border p-3 rounded-md">
                        <Checkbox 
                          id={`day-${day.id}`} 
                          name="days_of_week" 
                          value={day.id.toString()} 
                          defaultChecked={settings.days_of_week?.includes(day.id)}
                        />
                        <label htmlFor={`day-${day.id}`} className="text-sm font-medium leading-none cursor-pointer">
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA MENSAGENS */}
          <TabsContent value="mensagens" className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex gap-3 text-sm mb-4">
                <Info className="h-5 w-5 shrink-0" />
                <div>
                    <p className="font-bold">Variáveis Disponíveis:</p>
                    <p>Use <strong>{'{name}'}</strong> para o nome do cliente, <strong>{'{date}'}</strong> para a data, <strong>{'{time}'}</strong> para o horário e <strong>{'{service}'}</strong> para o serviço.</p>
                </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Personalização do Bot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-green-700">1. Ao Agendar (Confirmação Imediata)</Label>
                  <p className="text-xs text-muted-foreground">Enviada assim que o horário é marcado no sistema.</p>
                  <Textarea 
                    name="whatsapp_message_created" 
                    defaultValue={settings.whatsapp_message_created || "Olá {name}, seu agendamento foi confirmado para {date} às {time}."}
                    rows={3} 
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-base font-semibold text-blue-700">2. Lembrete (Dia Anterior)</Label>
                  <p className="text-xs text-muted-foreground">Enviada automaticamente no dia anterior à consulta.</p>
                  <Textarea 
                    name="whatsapp_message_reminder" 
                    defaultValue={settings.whatsapp_message_reminder || "Olá {name}, lembrete do seu agendamento amanhã às {time}. Confirma?"}
                    rows={3} 
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-base font-semibold text-red-700">3. Ao Cancelar</Label>
                  <p className="text-xs text-muted-foreground">Enviada quando você ou o cliente cancela o horário.</p>
                  <Textarea 
                    name="whatsapp_message_canceled" 
                    defaultValue={settings.whatsapp_message_canceled || "Olá {name}, seu agendamento foi cancelado."} 
                    rows={3} 
                  />
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" className="w-full md:w-auto">
              <Save className="mr-2 h-4 w-4" />
              Salvar Preferências
            </Button>
        </div>
      </form>
    </div>
  )
}