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
  CalendarDays,
  FileText,
  User,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  X,
  FileImage,
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
import { Textarea } from "@/components/ui/textarea"

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

type BookingStep = 1 | 2 | 3

export function PublicBookingForm({
  organizationId,
  organizationNiche,
  services,
  professionals,
  organizationName,
  headline = "Agende seu atendimento online",
  subtitle = "Escolha o serviço, selecione um horário disponível e receba a confirmação pelo WhatsApp.",
}: PublicBookingFormProps) {
  const [mounted, setMounted] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [dragActiveId, setDragActiveId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<BookingStep>(1)
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, File | null>>({})
  const [documentNotes, setDocumentNotes] = useState<Record<string, string>>({})
  const documents = useMemo(() => getNicheDocuments(organizationNiche), [organizationNiche])

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

  useEffect(() => {
    setMounted(true)
  }, [])

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

  const [documentValues, setDocumentValues] = useState<
    Record<string, { text?: string; file?: File }>
  >({})


  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId),
    [services, selectedServiceId]
  )

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === selectedProf),
    [professionals, selectedProf]
  )

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

  function setDocumentFile(documentId: string, file: File | null) {
    if (!file) return

    setDocumentValues((prev) => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        file,
      },
    }))
  }

  function removeDocumentFile(documentId: string) {
    setDocumentValues((prev) => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        file: undefined,
      },
    }))
  }

  function getFilePreview(file?: File) {
    if (!file) return null

    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file)
    }

    return null
  }

  function validateStep1() {
    const values = form.getValues()

    if (!values.service_id) {
      form.setError("service_id", { message: "Selecione um serviço" })
      toast.warning("Selecione um serviço para continuar.")
      return false
    }

    if (!values.professional_id) {
      form.setError("professional_id", { message: "Selecione um profissional" })
      toast.warning("Selecione um profissional para continuar.")
      return false
    }

    return true
  }

  function validateStep2() {
    const values = form.getValues()

    if (!values.date) {
      form.setError("date", { message: "Selecione uma data" })
      toast.warning("Selecione uma data para continuar.")
      return false
    }

    if (!values.time) {
      form.setError("time", { message: "Selecione um horário" })
      toast.warning("Selecione um horário para continuar.")
      return false
    }

    return true
  }

  async function handleFinalSubmit(values: z.infer<typeof formSchema>) {
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

      formData.append(
        "document_summary",
        JSON.stringify(
          documents.map((doc) => ({
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

  if (!mounted) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_380px] 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="h-8 w-48 rounded bg-muted animate-pulse" />
              <div className="h-24 w-full rounded bg-muted animate-pulse" />
              <div className="h-24 w-full rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="h-8 w-40 rounded bg-muted animate-pulse" />
              <div className="h-40 w-full rounded bg-muted animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
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
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_380px] 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <div className="space-y-6">
          <div className="space-y-4 text-center xl:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Atendimento online
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight max-w-3xl mx-auto xl:mx-0">
                {headline}
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto xl:mx-0">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap justify-center xl:justify-start gap-3 text-sm text-muted-foreground">
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

              <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <FileText className="h-4 w-4 text-sky-500" />
                Envio de documentos facilitado
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { step: 1 as BookingStep, label: "Atendimento" },
              { step: 2 as BookingStep, label: "Horário" },
              { step: 3 as BookingStep, label: "Seus dados" },
            ].map((item) => {
              const active = currentStep === item.step
              const done = currentStep > item.step

              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => {
                    if (item.step === 1) {
                      setCurrentStep(1)
                      return
                    }
                    if (item.step === 2 && validateStep1()) {
                      setCurrentStep(2)
                      return
                    }
                    if (item.step === 3 && validateStep1() && validateStep2()) {
                      setCurrentStep(3)
                    }
                  }}
                  className={cn(
                    "rounded-2xl border px-3 py-3 transition-all text-left",
                    active && "border-primary bg-primary/10 text-foreground",
                    done && "border-emerald-300 bg-emerald-50 text-emerald-900",
                    !active && !done && "border-zinc-800 bg-background text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border",
                        active && "border-primary bg-primary text-primary-foreground",
                        done && "border-emerald-600 bg-emerald-600 text-white",
                        !active && !done && "border-zinc-500 text-zinc-300"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : item.step}
                    </div>

                    <span className="text-sm font-medium leading-tight">
                      {item.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFinalSubmit)} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Escolha o atendimento
                    </h2>
                  </div>

                  <Card className="border-border bg-card shadow-sm">
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                    </CardContent>

                    <CardFooter className="flex justify-end gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          if (validateStep1()) setCurrentStep(2)
                        }}
                        className="min-w-[160px]"
                      >
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Escolha o horário
                    </h2>
                  </div>

                  <Card className="border-border bg-card shadow-sm">
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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

                    <CardFooter className="flex justify-between gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                      </Button>

                      <Button
                        type="button"
                        onClick={() => {
                          if (validateStep2()) setCurrentStep(3)
                        }}
                        className="min-w-[160px]"
                      >
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </>
              )}

              {currentStep === 3 && (
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="pt-6 space-y-8">

                    {/* 🔹 DADOS DO CLIENTE */}
                    <div className="space-y-6">
                      <h2 className="text-lg font-semibold">Seus dados</h2>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                                <Input placeholder="(33) 99999-9999" {...field} />
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
                              <FormLabel>Data de nascimento (opcional)</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="customer_gender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gênero (opcional)</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="male">Masculino</SelectItem>
                                  <SelectItem value="female">Feminino</SelectItem>
                                  <SelectItem value="other">Outro</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações (opcional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Alguma observação adicional?" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 🔹 DOCUMENTOS DINÂMICOS */}
                    {documents.length > 0 && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg font-semibold">Documentos</h2>
                          <p className="text-sm text-muted-foreground">
                            Envie os documentos solicitados para agilizar seu atendimento
                          </p>
                        </div>

                        <div className="space-y-4">
                          {documents.map((doc) => {
                            const selectedFile = documentValues?.[doc.id]?.file
                            const previewUrl = getFilePreview(selectedFile)

                            return (
                              <div
                                key={doc.id}
                                className="border rounded-xl p-4 bg-muted/30 space-y-4"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="font-medium">{doc.label}</p>
                                    {doc.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {doc.description}
                                      </p>
                                    )}
                                  </div>

                                  {doc.required && (
                                    <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400">
                                      obrigatório
                                    </span>
                                  )}
                                </div>

                                <Input
                                  placeholder={`Informe ${doc.label.toLowerCase()}`}
                                  onChange={(e) => {
                                    setDocumentValues((prev) => ({
                                      ...prev,
                                      [doc.id]: {
                                        ...prev[doc.id],
                                        text: e.target.value,
                                      },
                                    }))
                                  }}
                                  value={documentValues?.[doc.id]?.text || ""}
                                />

                                <div className="space-y-3">
                                  <div className="text-xs text-muted-foreground">
                                    Arquivo do documento
                                  </div>

                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault()
                                      setDragActiveId(doc.id)
                                    }}
                                    onDragLeave={() => {
                                      setDragActiveId((prev) => (prev === doc.id ? null : prev))
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      setDragActiveId(null)

                                      const file = e.dataTransfer.files?.[0]
                                      if (!file) return

                                      setDocumentFile(doc.id, file)
                                    }}
                                    className={cn(
                                      "relative rounded-2xl border border-dashed transition-all bg-background",
                                      dragActiveId === doc.id
                                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                        : "border-zinc-300 hover:border-primary/60 hover:bg-primary/5",
                                      selectedFile && "border-emerald-400 bg-emerald-500/5"
                                    )}
                                  >
                                    {/* INPUT invisível cobre só a área de drop */}
                                    <input
                                      type="file"
                                      accept={Array.isArray(doc.accept) ? doc.accept.join(",") : doc.accept}
                                      className="absolute inset-0 z-10 cursor-pointer opacity-0"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        setDocumentFile(doc.id, file)
                                      }}
                                    />

                                    <div className="relative z-0 flex flex-col items-center justify-center gap-3 px-4 py-6 text-center">
                                      {!selectedFile && (
                                        <>
                                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                            <UploadCloud className="h-5 w-5" />
                                          </div>

                                          <div className="space-y-1">
                                            <p className="text-sm font-medium text-foreground">
                                              Arraste e solte aqui
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              ou clique para selecionar um arquivo
                                            </p>
                                          </div>

                                          <p className="text-[11px] text-muted-foreground">
                                            Formatos aceitos: PDF, JPG, JPEG, PNG e WEBP
                                          </p>
                                        </>
                                      )}

                                      {selectedFile && (
                                        <div className="w-full space-y-4">
                                          <div className="flex flex-col items-center gap-3">
                                            {previewUrl ? (
                                              <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
                                                <img
                                                  src={previewUrl}
                                                  alt={selectedFile.name}
                                                  className="h-36 w-full max-w-[220px] object-cover"
                                                />
                                              </div>
                                            ) : (
                                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                                                <FileText className="h-6 w-6" />
                                              </div>
                                            )}

                                            <div className="space-y-1">
                                              <p className="text-sm font-medium text-foreground break-all">
                                                {selectedFile.name}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* BOTÕES FORA DA ÁREA COBERTA PELO INPUT */}
                                  {selectedFile && (
                                    <div className="relative z-20 flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeDocumentFile(doc.id)}
                                      >
                                        <X className="mr-2 h-4 w-4" />
                                        Remover arquivo
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )})}
                        </div>
                      </div>
                    )}

                    {/* 🔹 AÇÕES */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(2)}
                        className="w-full sm:w-auto"
                      >
                        Voltar
                      </Button>

                      <Button
                        type="submit"
                        disabled={form.formState.isSubmitting || isPending}
                        className="w-full sm:w-auto"
                      >
                        {form.formState.isSubmitting ? "Enviando..." : "Agendar agora"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </form>
          </Form>
          </div>

          {/* 🔹 RESUMO LATERAL */}
          <aside className="space-y-6 xl:sticky xl:top-6 self-start">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Resumo do agendamento</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Serviço
                      </p>
                      <p className="text-sm font-medium">
                        {selectedService?.title || "Ainda não selecionado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Profissional
                      </p>
                      <p className="text-sm font-medium">
                        {selectedProfessional?.name || "Ainda não selecionado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Data e horário
                      </p>
                      <p className="text-sm font-medium">
                        {selectedDate
                          ? `${format(selectedDate, "PPP", { locale: ptBR })}${
                              selectedTime ? ` às ${selectedTime}` : ""
                            }`
                          : "Ainda não selecionado"}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedService?.price && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Valor do serviço
                    </p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      R$ {Number(selectedService.price).toFixed(2)}
                    </p>
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Documentos
                    </p>

                    <p className="text-sm font-medium">
                      {Object.keys(documentValues).filter((key) => {
                        const item = documentValues[key]
                        return item?.text || item?.file
                      }).length} de {documents.length} item(ns) preenchido(s)
                    </p>

                    <div className="space-y-1">
                      {documents.map((doc) => {
                        const selectedFile = documentValues?.[doc.id]?.file

                        return (
                          <div
                            key={doc.id}
                            className="border rounded-xl p-4 bg-muted/30 space-y-3"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-medium">{doc.label}</p>
                                {doc.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {doc.description}
                                  </p>
                                )}
                              </div>

                              {doc.required && (
                                <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400">
                                  obrigatório
                                </span>
                              )}
                            </div>

                            <Input
                              placeholder={`Informe ${doc.label.toLowerCase()}`}
                              onChange={(e) => {
                                setDocumentValues((prev) => ({
                                  ...prev,
                                  [doc.id]: {
                                    ...prev[doc.id],
                                    text: e.target.value,
                                  },
                                }))
                              }}
                            />

                            <div className="flex items-center gap-3">
                              <Input
                                type="file"
                                accept={Array.isArray(doc.accept) ? doc.accept.join(",") : doc.accept}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (!file) return

                                  setDocumentValues((prev) => ({
                                    ...prev,
                                    [doc.id]: {
                                      ...prev[doc.id],
                                      file,
                                    },
                                  }))
                                }}
                              />

                              {selectedFile && (
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                  {selectedFile.name}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                    <span>
                      Seus dados são usados apenas para registrar e confirmar seu atendimento.
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    <span>
                      Após o envio, a confirmação será feita via WhatsApp.
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      Normalmente respondemos em poucos minutos.
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Organização
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {organizationName || "Nossa equipe"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
  )
}