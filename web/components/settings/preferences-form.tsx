'use client'

import { useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, MessageSquare, Save, Loader2,  Coffee } from "lucide-react"
import { updatePreferences } from "@/app/actions/update-preferences"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { useKeckleon } from "@/providers/keckleon-provider"


export function PreferencesForm({ settings, organizationId, organizationData }: { settings: any, organizationId: string, organizationData?: any }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Refs para variáveis
  const pendingMsgRef = useRef<HTMLTextAreaElement>(null)
  const createdMsgRef = useRef<HTMLTextAreaElement>(null)
  const reminderMsgRef = useRef<HTMLTextAreaElement>(null)
  const canceledMsgRef = useRef<HTMLTextAreaElement>(null)
  const doctorSummaryMsgRef = useRef<HTMLTextAreaElement>(null)

  const daysMap = [
    { id: 1, label: 'Segunda' },
    { id: 2, label: 'Terça' },
    { id: 3, label: 'Quarta' },
    { id: 4, label: 'Quinta' },
    { id: 5, label: 'Sexta' },
    { id: 6, label: 'Sábado' },
    { id: 0, label: 'Domingo' },
  ]
  
  const { dict } = useKeckleon()

  const actions = dict.actions || {}
  const messages = dict.messages || {}
  const fields = dict.fields || {}
  const sections = dict.sections || {}

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePreferences(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(messages.settings_saved || "Configurações salvas com sucesso!")
      router.refresh()
    })
  }

  const insertVariable = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    variable: string
  ) => {
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

  const VariableBadges = ({
    targetRef,
    variables,
  }: {
    targetRef: React.RefObject<HTMLTextAreaElement | null>
    variables: string[]
  }) => (
    <div className="flex gap-2 mt-2 mb-1 flex-wrap">
      {variables.map((v) => (
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="horarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
          <TabsTrigger value="horarios" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {sections.schedule || "Horários"}
          </TabsTrigger>

          <TabsTrigger value="mensagens" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {sections.messages || "Mensagens"}
          </TabsTrigger>
        </TabsList>

        {/* --- ABA 1: HORÁRIOS --- */}
        <TabsContent value="horarios" className="animate-in fade-in zoom-in-95 duration-200">
          <form action={handleSubmit}>
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="form_type" value="schedule" />

              <Card>
                <CardHeader>
                  <CardTitle>
                    {sections.business_hours || "Horários de funcionamento"}
                  </CardTitle>
                  <CardDescription>
                    {messages.business_hours_description ||
                      "Defina a jornada de trabalho e intervalos da sua organização."}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3 p-4 bg-zinc-50/10 rounded-lg border border-zinc-50">
                        <Label>
                          <Clock className="w-4 h-4 text-green-600" />
                          {messages.work_hours || "Expediente"}
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span>{fields.opening || "Abertura"}</span>
                                <Input type="time" name="open_hours_start" defaultValue={settings?.open_hours_start || "08:00"} />
                            </div>
                            <div>
                                <span>{fields.closing || "Fechamento"}</span>
                                <Input type="time" name="open_hours_end" defaultValue={settings?.open_hours_end || "18:00"} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 p-4 bg-zinc-50/10 rounded-lg border border-zinc-50">
                        <Label>
                          <Coffee className="w-4 h-4 text-orange-600"/>
                            {messages.break_label || "Almoço / Pausa"}
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span>{fields.start || "Início"}</span>
                                <Input type="time" name="lunch_start" defaultValue={settings?.lunch_start || "12:00"} />
                            </div>
                            <div>
                                <span>{fields.end || "Fim"}</span>
                                <Input type="time" name="lunch_end" defaultValue={settings?.lunch_end || "13:00"} />
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{messages.appointment_duration || "Duração da Consulta (minutos)"}</Label>
                    <Input type="number" name="appointment_duration" defaultValue={settings?.appointment_duration || 30} className="max-w-[200px]" />
                  </div>

                  <div className="space-y-3">
                    <Label>{messages.attendance_days_label || "Dias de Atendimento"}</Label>
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
                <div className="flex justify-end p-6 pt-5 border-t mt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {actions.save_schedule || "Salvar Horários"}
                  </Button>
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
                    <CardTitle>{sections.automation || "Automação de Mensagens"}</CardTitle>
                    <CardDescription>{messages.automation_description || "Personalize as mensagens automáticas enviadas pelo sistema."}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Label className="text-base font-semibold text-amber-600">
                        {messages.msg_pending || "Ao receber pré-agendamento"}
                      </Label>

                      <VariableBadges
                        targetRef={pendingMsgRef}
                        variables={["{name}", "{date}", "{time}", "{service}", "{professional}"]}
                      />
                    </div>

                    <Textarea
                      ref={pendingMsgRef}
                      name="msg_appointment_pending"
                      defaultValue={settings?.msg_appointment_pending}
                      placeholder={
                        messages.msg_pending_placeholder ||
                        "Olá {name}, recebemos sua solicitação de agendamento para {service} em {date} às {time}. Em breve nossa equipe confirmará o horário."
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Label className="text-base font-semibold text-green-600">
                        {messages.msg_confirm || "Ao confirmar agendamento"}
                      </Label>

                      <VariableBadges
                        targetRef={createdMsgRef}
                        variables={["{name}", "{date}", "{time}", "{service}", "{professional}"]}
                      />
                    </div>

                    <Textarea
                      ref={createdMsgRef}
                      name="msg_appointment_created"
                      defaultValue={settings?.msg_appointment_created}
                      placeholder={
                        messages.msg_confirm_placeholder ||
                        "Olá {name}, seu agendamento para {service} em {date} às {time} foi confirmado com {professional}."
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-blue-600 flex justify-between">
                        {messages.msg_reminder || "Lembrete de Consulta"}
                        <VariableBadges
                          targetRef={reminderMsgRef}
                          variables={['{name}', '{date}', '{time}', '{service}', '{professional}']}
                        />
                    </Label>
                    <Textarea 
                      ref={reminderMsgRef}
                      name="msg_appointment_reminder" 
                      defaultValue={settings?.msg_appointment_reminder}
                      placeholder={messages.msg_reminder_placeholder || "Olá {name}, este é um lembrete do seu agendamento para {date} às {time} com {professional}."}
                      rows={3} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-violet-600 flex justify-between">
                      {messages.msg_daily_summary || "Resumo Diário"}
                      <VariableBadges
                        targetRef={doctorSummaryMsgRef}
                        variables={['{name}', '{date}', '{appointments}', '{count}']}
                      />
                    </Label>
                    <Textarea
                      ref={doctorSummaryMsgRef}
                      name="msg_doctor_daily_summary"
                      defaultValue={settings?.msg_doctor_daily_summary}
                      placeholder={`Bom dia, {name}!

                  Sua agenda de hoje:

                  {appointments}

                  Total: {count} paciente(s).`}
                      rows={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold text-red-600 flex justify-between">
                        {messages.msg_cancel || "Ao cancelar"}
                        <VariableBadges
                          targetRef={canceledMsgRef}
                          variables={['{name}', '{date}', '{time}', '{service}']}
                        />
                    </Label>
                    <Textarea 
                      ref={canceledMsgRef}
                      name="msg_appointment_canceled" 
                      defaultValue={settings?.msg_appointment_canceled} 
                      placeholder={messages.msg_cancel_placeholder || "Que pena, {name}. Agendamento cancelado."}
                      rows={3} 
                    />
                  </div>
                </CardContent>
                <div className="flex justify-end p-6 pt-5 border-t mt-4">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {actions.save_messages || "Salvar Mensagens"}
                  </Button>
                </div>
              </Card>
          </form>
        </TabsContent>        
      </Tabs>
    </div>
  )
}