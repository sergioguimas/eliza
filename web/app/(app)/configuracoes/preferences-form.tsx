'use client'

import { useTransition, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, MessageSquare, Save, Loader2, Link as LinkIcon, Coffee, Server, ShieldCheck, Copy } from "lucide-react"
import { updatePreferences } from "@/app/actions/update-preferences"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export function PreferencesForm({ settings, organizationId, organizationData }: { settings: any, organizationId: string, organizationData?: any }) {
  const [isPending, startTransition] = useTransition()

  // Refs para variáveis
  const createdMsgRef = useRef<HTMLTextAreaElement>(null)
  const reminderMsgRef = useRef<HTMLTextAreaElement>(null)
  const canceledMsgRef = useRef<HTMLTextAreaElement>(null)

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

  const insertVariable = (ref: React.RefObject<HTMLTextAreaElement>, variable: string) => {
    if (ref.current) {
        const start = ref.current.selectionStart
        const end = ref.current.selectionEnd
        const text = ref.current.value
        const before = text.substring(0, start)
        const after = text.substring(end, text.length)
        ref.current.value = before + variable + after
        ref.current.focus()
        ref.current.selectionStart = ref.current.selectionEnd = start + variable.length
    }
  }

  const VariableBadges = ({ targetRef }: { targetRef: any }) => (
      <div className="flex gap-2 mt-2 mb-1 flex-wrap">
          {['{name}', '{date}', '{time}', '{service}'].map(v => (
              <Badge 
                key={v} 
                variant="outline" 
                className="cursor-pointer hover:bg-zinc-100 active:scale-95 transition-all"
                onClick={() => insertVariable(targetRef, v)}
              >
                  {v}
              </Badge>
          ))}
      </div>
  )

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text)
      toast.success("Copiado para a área de transferência")
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="horarios" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12">
            <TabsTrigger value="horarios" className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Horários
            </TabsTrigger>
            <TabsTrigger value="mensagens" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Mensagens
            </TabsTrigger>
            <TabsTrigger value="conexao" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> Conexão WhatsApp
            </TabsTrigger>
        </TabsList>

        {/* --- ABA 1: HORÁRIOS --- */}
        <TabsContent value="horarios" className="animate-in fade-in zoom-in-95 duration-200">
          <form action={handleSubmit}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="form_type" value="schedule" />

              <Card>
                <CardHeader>
                    <CardTitle>Horários de Funcionamento</CardTitle>
                    <CardDescription>Defina a jornada de trabalho e intervalos.</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 bg-zinc-50/10 rounded-lg border border-zinc-50">
                        <Label className="flex items-center gap-2"><Clock className="w-4 h-4 text-green-600"/> Expediente</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs text-muted-foreground">Abertura</span>
                                <Input type="time" name="open_hours_start" defaultValue={settings?.open_hours_start || "08:00"} />
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">Fechamento</span>
                                <Input type="time" name="open_hours_end" defaultValue={settings?.open_hours_end || "18:00"} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 p-4 bg-zinc-50/10 rounded-lg border border-zinc-50">
                        <Label className="flex items-center gap-2"><Coffee className="w-4 h-4 text-orange-600"/> Almoço / Pausa</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs text-muted-foreground">Início</span>
                                <Input type="time" name="lunch_start" defaultValue={settings?.lunch_start || "12:00"} />
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">Fim</span>
                                <Input type="time" name="lunch_end" defaultValue={settings?.lunch_end || "13:00"} />
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração da Consulta (minutos)</Label>
                    <Input type="number" name="appointment_duration" defaultValue={settings?.appointment_duration || 30} className="max-w-[200px]" />
                  </div>

                  <div className="space-y-3">
                    <Label>Dias de Atendimento</Label>
                    <div className="flex flex-wrap gap-4">
                      {daysMap.map((day) => (
                        <div key={day.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent transition-colors cursor-pointer">
                          <Checkbox 
                            id={`day-${day.id}`}
                            name="days_of_week" 
                            value={day.id.toString()} 
                            defaultChecked={settings?.days_of_week?.includes(day.id)}
                          />
                          <label htmlFor={`day-${day.id}`} className="text-sm font-medium leading-none cursor-pointer">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <div className="flex justify-end p-6 pt-0">
                  <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Horários</Button>
                </div>
              </Card>
          </form>
        </TabsContent>

        {/* --- ABA 2: MENSAGENS --- */}
        <TabsContent value="mensagens" className="animate-in fade-in zoom-in-95 duration-200">
          <form action={handleSubmit}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="form_type" value="messages" />

              <Card>
                <CardHeader>
                    <CardTitle>Automação de Mensagens</CardTitle>
                    <CardDescription>Personalize as mensagens automáticas enviadas pelo robô.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-8">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-green-600 flex justify-between">
                        Ao Confirmar Agendamento
                        <VariableBadges targetRef={createdMsgRef} />
                    </Label>
                    <Textarea 
                      ref={createdMsgRef}
                      name="msg_appointment_created" 
                      defaultValue={settings?.msg_appointment_created}
                      placeholder="Olá {name}, seu agendamento..."
                      rows={3} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-blue-600 flex justify-between">
                        Lembrete (Dia Anterior)
                        <VariableBadges targetRef={reminderMsgRef} />
                    </Label>
                    <Textarea 
                      ref={reminderMsgRef}
                      name="msg_appointment_reminder" 
                      defaultValue={settings?.msg_appointment_reminder}
                      placeholder="Lembrete: Consulta amanhã às {time}..."
                      rows={3} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-red-600 flex justify-between">
                        Ao Cancelar
                        <VariableBadges targetRef={canceledMsgRef} />
                    </Label>
                    <Textarea 
                      ref={canceledMsgRef}
                      name="msg_appointment_canceled" 
                      defaultValue={settings?.msg_appointment_canceled} 
                      placeholder="Que pena, {name}. Agendamento cancelado."
                      rows={3} 
                    />
                  </div>
                </CardContent>
                <div className="flex justify-end p-6 pt-0">
                  <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Mensagens</Button>
                </div>
              </Card>
          </form>
        </TabsContent>

        {/* --- ABA 3: CONEXÃO (Apenas Leitura) --- */}
        <TabsContent value="conexao" className="animate-in fade-in zoom-in-95 duration-200">
            <Card className="border-blue-100 bg-blue-50/20 dark:border-blue-900/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-blue-600" /> 
                        Status da Conexão
                    </CardTitle>
                    <CardDescription>Informações sobre a instância do WhatsApp conectada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {/* Status visual */}
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm">
                        <div className="p-2 bg-green-100 rounded-full animate-pulse">
                            <Server className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Servidor Ativo</span>
                            <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
                                <ShieldCheck className="w-3 h-3" /> Instância Sincronizada
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Nome da Instância (ID Interno)</Label>
                        <div className="flex gap-2">
                            <Input 
                                readOnly 
                                disabled
                                value={organizationData?.slug || "Não configurado"}
                                className="bg-zinc-100 dark:bg-zinc-800 font-mono text-muted-foreground"
                            />
                            <Button variant="outline" size="icon" onClick={() => copyToClipboard(organizationData?.slug || "")}>
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Este identificador é gerenciado automaticamente pelo sistema. Entre em contato com o suporte para alterações.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}