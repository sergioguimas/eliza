'use client'

import { useState, useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  CalendarIcon,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  MessageCircleMore,
  User2,
  CalendarDays,
  Briefcase,
  FileText,
  Upload,
  FileCheck2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { createAppointment } from "@/app/actions/create-appointment"
import { getAvailableSlots } from "@/app/actions/get-available-slots"
import { Database } from "@/utils/database.types"
import { getNicheDocuments } from "@/lib/niche-documents"

const formSchema = z.object({
  organization_id: z.string(),
  service_id: z.string().min(1, "Selecione um serviço"),
  professional_id: z.string().min(1, "Selecione um profissional"),
  date: z.date().refine((val) => val !== null, "Selecione uma data"),
  time: z.string().min(1, "Selecione um horário"),

  customer_name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  customer_phone: z.string().min(10, "Informe um telefone válido com DDD"),

  customer_document: z.string().min(11, "Informe o documento principal"),
  customer_birth_date: z.string().optional(),
  customer_gender: z.string().optional(),
  notes: z.string().optional(),
})

interface PublicBookingFormProps {
  organizationId: string
  organizationNiche?: string
  services: Database['public']['Tables']['services']['Row'][]
  professionals: Database['public']['Tables']['professionals']['Row'][]
  organizationName?: string
  headline?: string
  subtitle?: string
}

export function PublicBookingForm({
  organizationId,
  organizationNiche,
  services,
  professionals,
  organizationName = "Nossa equipe",
  headline = "Agende seu atendimento online",
  subtitle = "Escolha o serviço, selecione um horário disponível e receba a confirmação pelo WhatsApp.",
}: PublicBookingFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, File | null>>({})
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({})

  const expectedDocuments = useMemo(
    () => getNicheDocuments(organizationNiche),
    [organizationNiche]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization_id: organizationId,
      customer_name: "",
      customer_phone: "",
      customer_document: "",
      customer_birth_date: "",
      customer_gender: "",
      notes: "",
      service_id: "",
      professional_id: "",
      time: "",
    },
  })

  const phoneMask = (value: string) => {
    if (!value) return ""
    value = value.replace(/\D/g, "")
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2")
    value = value.replace(/(\d{5})(\d)/, "$1-$2")
    return value.substring(0, 15)
  }

  const selectedDate = form.watch("date")
  const selectedProf = form.watch("professional_id")
  const selectedServiceId = form.watch("service_id")
  const selectedTime = form.watch("time")
  const customerName = form.watch("customer_name")

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId),
    [services, selectedServiceId]
  )

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === selectedProf),
    [professionals, selectedProf]
  )

  const currentStep = useMemo(() => {
    if (!selectedServiceId || !selectedProf) return 1
    if (!selectedDate || !selectedTime) return 2
    return 3
  }, [selectedServiceId, selectedProf, selectedDate, selectedTime])

  const uploadedCount = useMemo(
    () => Object.values(selectedDocuments).filter(Boolean).length,
    [selectedDocuments]
  )

  const describedDocumentsCount = useMemo(
    () => Object.values(documentNotes).filter((value) => value?.trim()).length,
    [documentNotes]
  )

  useEffect(() => {
    async function updateSlots() {
      if (selectedDate && selectedProf) {
        setLoadingSlots(true)
        try {
          const available = await getAvailableSlots(selectedProf, selectedDate, organizationId)
          setSlots(available)
          form.setValue("time", "")
        } catch {
          toast.error("Erro ao carregar horários disponíveis.")
        } finally {
          setLoadingSlots(false)
        }
      } else {
        setSlots([])
      }
    }

    updateSlots()
  }, [selectedDate, selectedProf, organizationId, form])

  function handleDocumentChange(documentId: string, file: File | null) {
    setSelectedDocuments((prev) => ({
      ...prev,
      [documentId]: file,
    }))
  }

  function handleDocumentNoteChange(documentId: string, value: string) {
    setDocumentNotes((prev) => ({
      ...prev,
      [documentId]: value,
    }))
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true)

    try {
      const [hours, minutes] = values.time.split(':')
      const startDateTime = new Date(values.date)
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

      const rawPhone = values.customer_phone.replace(/\D/g, "")
      const phoneWithDDI = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone

      const formData = new FormData()
      formData.append('organization_id', values.organization_id)
      formData.append('service_id', values.service_id)
      formData.append('professional_id', values.professional_id)
      formData.append('start_time', startDateTime.toISOString())
      formData.append('customer_name', values.customer_name)
      formData.append('customer_document', values.customer_document)
      formData.append('customer_birth_date', values.customer_birth_date || "")
      formData.append('customer_gender', values.customer_gender || "")
      formData.append('customer_phone', phoneWithDDI)
      formData.append('notes', values.notes || "")
      formData.append('source', 'public')

      // Estrutura preparada para a próxima fase:
      // descrição textual dos documentos esperados
      formData.append(
        "document_summary",
        JSON.stringify(
          expectedDocuments.map((doc) => ({
            id: doc.id,
            label: doc.label,
            description_text: documentNotes[doc.id] || "",
            has_selected_file: Boolean(selectedDocuments[doc.id]),
          }))
        )
      )

      const result = await createAppointment(formData)

      if (result?.success) {
        setIsSuccess(true)

        if (result.foundName) {
          toast.success(`Cadastro localizado: ${result.foundName}`)
        }

        toast.success("Solicitação enviada com sucesso!")
        setIsPending(false)
        return
      }

      toast.error(result?.error || "Erro ao solicitar agendamento.")
      setIsPending(false)
    } catch (error) {
      console.error(error)
      toast.error("Erro ao solicitar agendamento.")
      setIsPending(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="mx-auto max-w-2xl border-emerald-500/20 bg-emerald-500/5 shadow-xl animate-in fade-in zoom-in">
        <CardContent className="pt-10 pb-10 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Solicitação enviada</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Olá <strong>{form.getValues("customer_name")}</strong>, recebemos seu pedido.
              Em breve você receberá a confirmação pelo WhatsApp.
            </p>
          </div>

          <div className="mx-auto max-w-md rounded-2xl border bg-background p-4 text-left space-y-2">
            <p className="text-sm">
              <strong>Serviço:</strong> {selectedService?.title || "—"}
            </p>
            <p className="text-sm">
              <strong>Profissional:</strong> {selectedProfessional?.name || "—"}
            </p>
            <p className="text-sm">
              <strong>Data:</strong>{" "}
              {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "—"}
            </p>
            <p className="text-sm">
              <strong>Horário:</strong> {selectedTime || "—"}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            ⏱ Normalmente respondemos em poucos minutos
          </p>

          <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
            Realizar novo agendamento
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Atendimento online
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {headline}
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Horários atualizados em tempo real
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
              <MessageCircleMore className="h-4 w-4 text-primary" />
              Confirmação rápida via WhatsApp
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Processo simples e rápido
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { step: 1, label: "Atendimento" },
            { step: 2, label: "Horário" },
            { step: 3, label: "Seus dados" },
          ].map((item) => {
            const active = currentStep === item.step
            const done = currentStep > item.step

            return (
              <div
                key={item.step}
                className={cn(
                  "rounded-2xl border px-4 py-3 transition-all",
                  active && "border-primary bg-primary/5",
                  done && "border-emerald-200 bg-emerald-50",
                  !active && !done && "bg-background"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold border",
                      active && "border-primary bg-primary text-primary-foreground",
                      done && "border-emerald-500 bg-emerald-500 text-white",
                      !active && !done && "border-zinc-300 text-zinc-500"
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : item.step}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Escolha o atendimento
              </h2>
            </div>

            <Card className="border-border bg-card shadow-sm">
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="service_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serviço</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de atendimento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.title} — R$ {Number(s.price).toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="professional_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profissional</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha quem irá atender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {professionals.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: ptBR })
                                ) : (
                                  <span>Selecione o dia</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>

                          <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex flex-col">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => field.onChange(date)}
                                month={field.value}
                                onMonthChange={(month) => field.onChange(month)}
                                disabled={(date) => date < new Date() || date.getDay() === 0}
                                initialFocus
                                locale={ptBR}
                              />

                              <div className="p-3 border-t border-border grid grid-cols-2 gap-2 bg-muted/20">
                                {[
                                  { label: "Hoje", value: 0 },
                                  { label: "Amanhã", value: 1 },
                                  { label: "Próx. Segunda", value: (8 - new Date().getDay()) % 7 || 7 },
                                  { label: "Em 1 semana", value: 7 },
                                ].map((preset) => (
                                  <Button
                                    key={preset.label}
                                    variant="outline"
                                    size="sm"
                                    className="text-[10px] h-8"
                                    type="button"
                                    onClick={() => {
                                      const newDate = addDays(new Date(), preset.value)
                                      if (newDate.getDay() !== 0) {
                                        field.onChange(newDate)
                                      } else {
                                        toast.error("Este atalho cai em um domingo.")
                                      }
                                    }}
                                  >
                                    {preset.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário disponível</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={loadingSlots || !selectedDate || slots.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              {loadingSlots ? (
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Buscando horários...</span>
                                </div>
                              ) : (
                                <SelectValue
                                  placeholder={
                                    slots.length > 0
                                      ? "Escolha a hora"
                                      : "Escolha data e profissional primeiro"
                                  }
                                />
                              )}
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {slots.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {slots.length === 0 && selectedDate && !loadingSlots && (
                          <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Não encontramos horários disponíveis para este dia.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Seus dados
              </h2>
            </div>

            <Card className="border-border bg-card shadow-sm">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite seu nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customer_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone para contato</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(33) 99999-9999"
                            {...field}
                            onChange={(e) => {
                              const masked = phoneMask(e.target.value)
                              field.onChange(masked)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customer_document"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Documento principal</FormLabel>
                        <FormControl>
                          <Input placeholder="CPF ou documento principal" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customer_birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento <span className="text-muted-foreground">(opcional)</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customer_gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gênero <span className="text-muted-foreground">(opcional)</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações <span className="text-muted-foreground">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Alguma observação adicional?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {expectedDocuments.length > 0 && (
              <>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Documentos
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Para agilizar a análise do seu atendimento, você pode descrever e anexar os documentos solicitados abaixo.
                  </p>
                </div>

                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid gap-4">
                      {expectedDocuments.map((doc) => {
                        const selectedFile = selectedDocuments[doc.id]

                        return (
                          <div
                            key={doc.id}
                            className="rounded-2xl border border-border bg-muted/20 p-4"
                          >
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {doc.label}
                                  </p>

                                  {doc.required && (
                                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                                      Obrigatório
                                    </span>
                                  )}
                                </div>

                                {doc.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {doc.description}
                                  </p>
                                )}
                              </div>

                              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Descreva o documento ou informe a referência
                                  </label>
                                  <Input
                                    value={documentNotes[doc.id] || ""}
                                    onChange={(e) =>
                                      handleDocumentNoteChange(doc.id, e.target.value)
                                    }
                                    placeholder={`Ex: ${doc.label}, número, observação ou confirmação de envio`}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <label
                                    className={cn(
                                      "flex min-h-[52px] cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-3 text-sm transition-all",
                                      selectedFile
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                        : "border-zinc-300 bg-background hover:border-primary hover:bg-primary/5"
                                    )}
                                  >
                                    <input
                                      type="file"
                                      accept={doc.accept || ".pdf,.jpg,.jpeg,.png,.webp"}
                                      className="hidden"
                                      onChange={(e) =>
                                        handleDocumentChange(doc.id, e.target.files?.[0] || null)
                                      }
                                    />

                                    <span className="text-center">
                                      {selectedFile ? (
                                        <span className="inline-flex items-center gap-2">
                                          <FileCheck2 className="h-4 w-4" />
                                          {selectedFile.name}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-2">
                                          <Upload className="h-4 w-4" />
                                          Selecionar arquivo
                                        </span>
                                      )}
                                    </span>
                                  </label>

                                  <p className="text-[11px] text-muted-foreground">
                                    Formatos aceitos: PDF, JPG e PNG
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      Os arquivos selecionados ainda não serão enviados automaticamente para armazenamento.
                      Nesta fase, eles servem para preparar o fluxo visual e facilitar a conferência do atendimento.
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0">
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold transition-all"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Verificando disponibilidade...
                        </>
                      ) : (
                        "Agendar agora"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </>
            )}

            {expectedDocuments.length === 0 && (
              <Card className="border-border bg-card shadow-sm">
                <CardFooter className="pt-6">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold transition-all"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verificando disponibilidade...
                      </>
                    ) : (
                      "Agendar agora"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}
          </form>
        </Form>
      </div>

      <div className="space-y-6">
        <Card className="border-border bg-card shadow-sm sticky top-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Resumo do agendamento</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Briefcase className="h-4 w-4 mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Serviço</p>
                  <p className="text-sm font-medium">
                    {selectedService?.title || "Ainda não selecionado"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User2 className="h-4 w-4 mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Profissional</p>
                  <p className="text-sm font-medium">
                    {selectedProfessional?.name || "Ainda não selecionado"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CalendarDays className="h-4 w-4 mt-0.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Data e horário</p>
                  <p className="text-sm font-medium">
                    {selectedDate
                      ? `${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}${selectedTime ? ` às ${selectedTime}` : ""}`
                      : "Ainda não selecionado"}
                  </p>
                </div>
              </div>
            </div>

            {selectedService?.price != null && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Valor do serviço
                </p>
                <p className="mt-1 text-xl font-bold text-primary">
                  R$ {Number(selectedService.price).toFixed(2)}
                </p>
              </div>
            )}

            {expectedDocuments.length > 0 && (
              <div className="rounded-2xl border bg-background p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <p className="font-semibold">Documentos</p>
                </div>
                <p className="text-muted-foreground">
                  {describedDocumentsCount} descrito(s) • {uploadedCount} arquivo(s) selecionado(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  {expectedDocuments.length} item(ns) esperados para este nicho
                </p>
              </div>
            )}

            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-500" />
                <span>Seus dados são usados apenas para registrar e confirmar seu atendimento.</span>
              </div>

              <div className="flex items-start gap-2">
                <MessageCircleMore className="h-4 w-4 mt-0.5 text-primary" />
                <span>Após o envio, a confirmação será feita via WhatsApp.</span>
              </div>

              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-amber-500" />
                <span>Normalmente respondemos em poucos minutos.</span>
              </div>
            </div>

            {customerName && (
              <div className="rounded-2xl border bg-background p-4 text-sm">
                <p className="text-muted-foreground">Solicitação em nome de</p>
                <p className="font-semibold">{customerName}</p>
              </div>
            )}

            <div className="rounded-2xl border bg-background p-4 text-sm">
              <p className="text-muted-foreground">Organização</p>
              <p className="font-semibold">{organizationName}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}