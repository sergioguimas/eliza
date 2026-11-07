'use client'

import { useState, useEffect, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
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

import { createPublicAppointment } from "@/app/actions/create-appointment"
import { getAvailableSlots } from "@/app/actions/get-available-slots"
import type { Profissional, Servico } from "@/lib/domain/catalogo"
import type { AdicionalEscolhido } from "@/contracts/comum/adicionais"
import { somarAdicionais } from "@/lib/adicionais"
import { formatarReais, rotuloPreco } from "@/lib/preco"
import { AddonsPicker } from "@/components/appointments/addons-picker"
import { getNicheDocuments } from "@/lib/niche-documents"
import type { AcaoPreencherAgendamento, FormularioChat } from "@/contracts/autoatendimento"
import { dataLocal, etapaDaEscolha, filtrarAcao } from "@/lib/marcar/acao-chat"
import type { ResultadoDaAcao } from "./chat-agendamento"

// Org sem chat não baixa nada dele, nem o botão (contrato 08 §7).
const ChatFlutuante = dynamic(() => import("./chat-flutuante").then((m) => m.ChatFlutuante), { ssr: false })

const formSchema = z.object({
  organization_id: z.string(),
  service_id: z.string().min(1, "Selecione um serviço"),
  professional_id: z.string().min(1, "Selecione um profissional"),
  date: z.date().refine((val) => val !== null, "Selecione uma data"),
  time: z.string().min(1, "Selecione um horário"),

  customer_name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  customer_phone: z.string().regex(/^55\d{10,11}$/, "Informe um telefone válido."),

  // Desde 07/11/2026: documento opcional; a data de nascimento é obrigatória no lugar dele.
  customer_document: z.string().optional(),
  customer_birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe sua data de nascimento")
    .refine((v) => v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10), "Data de nascimento inválida"),
  customer_gender: z.string().optional(),
  notes: z.string().optional(),
})

interface PublicBookingFormProps {
  organizationId: string
  organizationNiche?: string
  services: Servico[]
  professionals: Profissional[]
  organizationName?: string
  /** Serviço pré-selecionado (`?servico=<id>`, ex.: link do site do cliente). Já validado pela página. */
  initialServiceId?: string
  /** Slug da org quando o chat está ativo (contrato 08). Ausente = nada do chat é carregado. */
  chatSlug?: string
  headline?: string
  subtitle?: string
}

type BookingStep = 1 | 2 | 3

function StepHeading({ step, title }: { step: BookingStep; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Etapa {step} de 3
      </p>
      <h3 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h3>
    </div>
  )
}

export function PublicBookingForm({
  organizationId,
  organizationNiche,
  services,
  professionals,
  organizationName,
  initialServiceId,
  chatSlug,
  headline ="Agende seu atendimento online",
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
  const [slotMessage, setSlotMessage] = useState<string | null>(null)
  // Só id e quantidade: nome e valor saem do catálogo no servidor.
  const [addons, setAddons] = useState<AdicionalEscolhido[]>([])
  // Hora que veio do chat, à espera dos horários do dia (C19): trocar serviço,
  // profissional ou data recarrega os horários e zera `time`.
  const horaPendente = useRef<{ hora: string; resolver: (entrou: boolean) => void } | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const barra = useRef<HTMLDivElement>(null)

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
      service_id: initialServiceId ?? "",
      professional_id: "",
      time: "",
    },
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  function formatPhoneBR(value: string) {
    const numbers = value.replace(/\D/g, "");

    // Remove 55 visualmente, caso já esteja salvo no form
    const withoutCountryCode = numbers.startsWith("55")
      ? numbers.slice(2)
      : numbers;

    const limited = withoutCountryCode.slice(0, 11);

    if (limited.length <= 10) {
      return limited
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }

    return limited
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function normalizePhoneBR(value: string) {
    const numbers = value.replace(/\D/g, "");

    const withoutCountryCode = numbers.startsWith("55")
      ? numbers.slice(2)
      : numbers;

    const limited = withoutCountryCode.slice(0, 11);

    if (!limited) return "";

    return `55${limited}`;
  }

  const selectedDate = form.watch("date")
  const selectedProf = form.watch("professional_id")
  const selectedServiceId = form.watch("service_id")
  const selectedTime = form.watch("time")

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

  // Escolhas com os dados do catálogo, para exibir. Id que não é do serviço atual é ignorado.
  const adicionaisEscolhidos = useMemo(
    () =>
      (selectedService?.adicionais ?? []).flatMap((a) => {
        const escolhido = addons.find((e) => e.id === a.id)

        if (!escolhido) return []

        const item = { valorUnitario: a.valor, quantidade: escolhido.quantidade }

        return [{ ...a, ...item, total: somarAdicionais([item]) }]
      }),
    [selectedService, addons]
  )

  const totalAdicionais = somarAdicionais(adicionaisEscolhidos)
  const precoDoServico = Number(selectedService?.preco ?? 0)
  const temPreco = precoDoServico > 0
  const totalEstimado = Math.round((precoDoServico + totalAdicionais) * 100) / 100
  const rotuloTotal = selectedService?.precoAPartirDe ? "Total a partir de" : "Total estimado"

  useEffect(() => {
    async function updateSlots() {
      if (selectedDate && selectedProf) {
        setLoadingSlots(true)
        try {
          const result = await getAvailableSlots(selectedProf, selectedDate, organizationId, selectedServiceId || undefined)
          setSlots(result.slots)
          setSlotMessage(result.message || null)
          const pendente = horaPendente.current
          const entrou = !!pendente && result.slots.includes(pendente.hora)

          form.setValue("time", entrou ? pendente.hora : "", { shouldValidate: entrou })
          horaPendente.current = null
          pendente?.resolver(entrou)
        } catch {
          toast.error("Erro ao carregar horários disponíveis.")
          horaPendente.current?.resolver(false)
          horaPendente.current = null
        } finally {
          setLoadingSlots(false)
        }
      } else {
        setSlots([])
        setSlotMessage(null)
        horaPendente.current?.resolver(false)
        horaPendente.current = null
      }
    }

    updateSlots()
  }, [selectedDate, selectedProf, selectedServiceId, organizationId, form])

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
      form.setError("time", {
        message: slotMessage || "Selecione um horário",
      })

      toast.warning(slotMessage || "Selecione um horário para continuar.")
      return false
    }

    return true
  }

  const mobileSummary = (() => {
    const parts = [
      selectedService?.titulo,
      selectedProfessional?.nome,
      selectedDate ? format(selectedDate, "dd/MM", { locale: ptBR }) + (selectedTime ? ` às ${selectedTime}` : "") : null,
      adicionaisEscolhidos.length === 0
        ? selectedService?.preco ? rotuloPreco(selectedService) : null
        : temPreco
          ? `${rotuloTotal.toLowerCase()} ${formatarReais(totalEstimado)}`
          : `adicionais + ${formatarReais(totalAdicionais)}`,
    ].filter(Boolean)

    if (parts.length > 0) return parts.join(" · ")
    return `Etapa ${currentStep} de 3`
  })()

  function goToNextStep() {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2)
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3)
  }

  // Ao trocar de etapa, traz o topo do formulário de volta à vista: no celular o
  // botão fica na barra fixa de baixo e a etapa nova começaria fora da tela.
  useEffect(() => {
    if (!mounted) return
    const el = document.getElementById("booking-steps")
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [currentStep, mounted])

  // A barra fixa do celular muda de altura; o botão do chat fica sempre acima dela.
  useEffect(() => {
    if (!chatSlug || !barra.current) return
    const observador = new ResizeObserver(([e]) => {
      raiz.current?.style.setProperty("--altura-barra", `${e.target.getBoundingClientRect().height}px`)
    })
    observador.observe(barra.current)
    return () => observador.disconnect()
  }, [chatSlug, mounted])

  function lerFormularioDoChat(): FormularioChat {
    const v = form.getValues()

    return {
      etapa: currentStep,
      servicoId: v.service_id || null,
      profissionalId: v.professional_id || null,
      data: v.date ? format(v.date, "yyyy-MM-dd") : null,
      hora: v.time || null,
    }
  }

  /** Contrato 08 §7.3. O agente sugere; só entra o que a página conhece. Nunca submete. */
  async function aplicarAcao(acao: AcaoPreencherAgendamento): Promise<ResultadoDaAcao> {
    const escolha = filtrarAcao(acao, {
      servicoIds: services.map((s) => s.id),
      profissionalIds: professionals.map((p) => p.id),
      hoje: new Date(),
    })
    const antes = form.getValues()
    const novaData = escolha.data ? dataLocal(escolha.data) : null
    const mudouServico = !!escolha.servicoId && escolha.servicoId !== antes.service_id
    const mudouProfissional = !!escolha.profissionalId && escolha.profissionalId !== antes.professional_id
    const mudouData = !!novaData && novaData.getTime() !== antes.date?.getTime()
    const recarrega = mudouServico || mudouProfissional || mudouData

    if (escolha.servicoId) form.setValue("service_id", escolha.servicoId, { shouldValidate: true })
    if (escolha.profissionalId) form.setValue("professional_id", escolha.profissionalId, { shouldValidate: true })
    if (novaData) form.setValue("date", novaData, { shouldValidate: true })

    const v = form.getValues()
    let horaEntrou = false

    if (escolha.hora) {
      // Sem data ou profissional o efeito não busca horários: nada a conferir.
      if (recarrega && v.date && v.professional_id) {
        horaEntrou = await new Promise<boolean>((resolver) => {
          horaPendente.current = { hora: escolha.hora!, resolver }
        })
      } else if (!recarrega && slots.includes(escolha.hora)) {
        form.setValue("time", escolha.hora, { shouldValidate: true })
        horaEntrou = true
      }
    }

    const final = form.getValues()

    setCurrentStep(
      etapaDaEscolha({
        servicoId: final.service_id,
        profissionalId: final.professional_id,
        data: final.date,
        hora: final.time,
      }) as BookingStep
    )

    const servico = services.find((s) => s.id === final.service_id)
    const profissional = professionals.find((p) => p.id === final.professional_id)
    const partes = [
      servico?.titulo,
      profissional && `com ${profissional.nome}`,
      final.date && format(final.date, "EEE dd/MM", { locale: ptBR }),
      final.time && `às ${final.time}`,
    ].filter(Boolean)
    const linhas: string[] = []

    if (escolha.servicoId || escolha.profissionalId || escolha.data || horaEntrou) {
      linhas.push(`Preenchi: ${partes.join(", ")}.`)
    }
    if (escolha.hora && !horaEntrou) {
      linhas.push(
        final.date && final.professional_id
          ? `O horário ${escolha.hora} não está mais livre; escolha outro na etapa 2.`
          : `Para conferir o horário ${escolha.hora}, escolha antes o profissional e a data.`
      )
    }
    if (escolha.descartou) linhas.push("Parte da sugestão não vale para esta página; confira no formulário.")

    return { linhas }
  }

  async function handleFinalSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true)

    try {
      const startDateTime = `${format(values.date, "yyyy-MM-dd")}T${values.time}:00`

      const rawPhone = values.customer_phone.replace(/\D/g, "")
      const phoneWithDDI = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone
      

      const formData = new FormData()
      formData.append('organization_id', values.organization_id)
      formData.append('service_id', values.service_id)
      formData.append('professional_id', values.professional_id)
      formData.append('start_time', startDateTime)
      formData.append('customer_name', values.customer_name)
      formData.append('customer_document', values.customer_document || "")
      formData.append('customer_birth_date', values.customer_birth_date || "")
      formData.append('customer_gender', values.customer_gender || "")
      formData.append('customer_phone', phoneWithDDI)
      formData.append('notes', values.notes || "")
      formData.append('source', 'public')
      formData.append(
        'addons',
        JSON.stringify(adicionaisEscolhidos.map((a) => ({ id: a.id, quantidade: a.quantidade })))
      )

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

      const result = await createPublicAppointment(formData)

      if (result?.success) {
        setIsSuccess(true)

        if ("foundName" in result && result.foundName) {
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
      <Card className="mx-auto max-w-2xl border-success/20 bg-success/5 shadow-xl animate-in fade-in zoom-in">
        <CardContent className="pt-10 pb-10 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
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
              <strong>Serviço:</strong> {selectedService?.titulo || "—"}
            </p>
            <p className="text-sm">
              <strong>Profissional:</strong> {selectedProfessional?.nome || "—"}
            </p>
            <p className="text-sm">
              <strong>Data:</strong>{" "}
              {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : "—"}
            </p>
            <p className="text-sm">
              <strong>Horário:</strong> {selectedTime || "—"}
            </p>
            {adicionaisEscolhidos.length > 0 && (
              <p className="text-sm">
                <strong>Adicionais:</strong>{" "}
                {adicionaisEscolhidos
                  .map((a) => (a.unidade ? `${a.nome} (${a.quantidade})` : a.nome))
                  .join(", ")}
              </p>
            )}
            {adicionaisEscolhidos.length > 0 && temPreco && (
              <p className="text-sm">
                <strong>{rotuloTotal}:</strong> {formatarReais(totalEstimado)}
              </p>
            )}
            {adicionaisEscolhidos.length > 0 && !temPreco && (
              <p className="text-sm">
                <strong>Valor dos adicionais:</strong> + {formatarReais(totalAdicionais)}
              </p>
            )}
            {adicionaisEscolhidos.length > 0 && (
              <p className="text-xs text-muted-foreground">O valor final é confirmado no atendimento.</p>
            )}
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
    <div ref={raiz} className="mx-auto w-full max-w-[1400px] px-0 sm:px-6 lg:px-8 pb-36 xl:pb-0">
      {chatSlug && (
        <ChatFlutuante
          slug={chatSlug}
          organizacao={organizationName || "Atendimento"}
          lerFormulario={lerFormularioDoChat}
          aplicarAcao={aplicarAcao}
        />
      )}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_380px] 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <div className="space-y-6">
          {/* No celular o herói fica enxuto: o nome da organização já é o h1 da
              página, e os selos empurravam as etapas para fora da primeira tela. */}
          <div className="space-y-4 text-center xl:text-left">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Atendimento online
            </div>

            <div className="space-y-2 sm:space-y-3">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight max-w-3xl mx-auto xl:mx-0">
                {headline}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto xl:mx-0">
                {subtitle}
              </p>
            </div>

            <div className="hidden sm:flex flex-wrap justify-center xl:justify-start gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Horários atualizados em tempo real
              </span>

              <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <MessageCircleMore className="h-4 w-4 text-primary" />
                Confirmação rápida via WhatsApp
              </span>

              <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <Clock className="h-4 w-4 text-primary" />
                Processo simples e rápido
              </span>

              <span className="inline-flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <FileText className="h-4 w-4 text-primary" />
                Envio de documentos facilitado
              </span>
            </div>
          </div>

          <ol id="booking-steps" className="grid grid-cols-3 gap-2 sm:gap-3 scroll-mt-4" aria-label="Etapas do agendamento">
            {[
              { step: 1 as BookingStep, label: "Serviço" },
              { step: 2 as BookingStep, label: "Horário" },
              { step: 3 as BookingStep, label: "Seus dados" },
            ].map((item) => {
              const active = currentStep === item.step
              const done = currentStep > item.step

              return (
                <li key={item.step}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
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
                  className="group w-full text-left"
                >
                  {/* Barra de progresso por etapa: lida como sequência mesmo sem texto */}
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-colors",
                      active && "bg-primary",
                      done && "bg-success",
                      !active && !done && "bg-muted"
                    )}
                  />
                  <span className="mt-2 flex items-center gap-1.5 sm:gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold border",
                        active && "border-primary bg-primary text-primary-foreground",
                        done && "border-success bg-success text-background",
                        !active && !done && "border-border text-muted-foreground"
                      )}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.step}
                    </span>

                    <span
                      className={cn(
                        "text-xs sm:text-sm leading-tight",
                        active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  </span>
                </button>
                </li>
              )
            })}
          </ol>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFinalSubmit, (errors) => console.log("Erros do form: ", errors))} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <StepHeading step={1} title="Escolha o atendimento" />

                  <Card className="border-border bg-card shadow-sm">
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="service_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Serviço</FormLabel>
                              <Select
                                onValueChange={(valor) => {
                                  field.onChange(valor)
                                  // Os adicionais pertencem ao serviço: outro serviço começa sem nenhum.
                                  setAddons([])
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione o tipo de atendimento" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {services.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.titulo} — {rotuloPreco(s)}
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
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Escolha quem irá atender" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {professionals.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <AddonsPicker adicionais={selectedService?.adicionais ?? []} value={addons} onChange={setAddons} />

                      {/* No celular o resumo lateral não aparece: o total estimado fica junto da escolha. */}
                      {adicionaisEscolhidos.length > 0 && (
                        <p className="text-sm text-foreground xl:hidden" aria-live="polite">
                          {temPreco ? (
                            <>
                              <span className="text-muted-foreground">{rotuloTotal}: </span>
                              <strong>{formatarReais(totalEstimado)}</strong>
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Adicionais: </span>
                              <strong>+ {formatarReais(totalAdicionais)}</strong>
                            </>
                          )}
                          <span className="block text-xs text-muted-foreground">
                            O valor final é confirmado no atendimento.
                          </span>
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="hidden xl:flex justify-end gap-3">
                      <Button
                        type="button"
                        onClick={goToNextStep}
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
                  <StepHeading step={2} title="Escolha o dia e o horário" />

                  <Card className="border-border bg-card shadow-sm">
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                                  <SelectTrigger className="w-full">
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

                              {slots.length === 0 && selectedDate && selectedProf && !loadingSlots && (
                                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {slotMessage || "Não encontramos horários disponíveis para este dia."}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>

                    <CardFooter className="hidden xl:flex justify-between gap-3">
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
                        onClick={goToNextStep}
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
                <>
                <StepHeading step={3} title="Informe seus dados" />
                <Card className="border-border bg-card shadow-sm">
                  <CardContent className="pt-6 space-y-8">

                    {/* 🔹 DADOS DO CLIENTE */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                                  value={formatPhoneBR(field.value ?? "")}
                                  onChange={(e) => {
                                    field.onChange(normalizePhoneBR(e.target.value));
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
                              <FormLabel>CPF/CNPJ (opcional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Digite seu CPF ou CNPJ"
                                  {...field}
                                />
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
                              <FormLabel>Data de nascimento</FormLabel>
                              <FormControl>
                                <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
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
                              <FormLabel>Gênero (opcional)</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="w-full">
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
                                    <span className="text-xs px-2 py-1 rounded border border-danger/40 text-danger">
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
                                        : "border-input hover:border-primary/60 hover:bg-primary/5",
                                      selectedFile && "border-success/60 bg-success/5"
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
                                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
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

                    {/* 🔹 AÇÕES (no celular ficam na barra fixa) */}
                    <div className="hidden xl:flex gap-4 pt-4">
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
                        {form.formState.isSubmitting || isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Agendar agora"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </>
              )}

              {/* Barra fixa do celular: o próximo passo é sempre o elemento mais
                  forte da tela, e o resumo vira uma linha de apoio acima dele. */}
              <div ref={barra} className="xl:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="mx-auto max-w-xl space-y-2">
                  <p className="truncate text-xs text-muted-foreground" aria-live="polite">
                    {mobileSummary}
                  </p>
                  <div className="flex gap-2">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="h-12 px-4"
                        aria-label="Voltar para a etapa anterior"
                        onClick={() => setCurrentStep((currentStep - 1) as BookingStep)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}

                    {currentStep < 3 ? (
                      <Button key="next" type="button" size="lg" className="h-12 flex-1 text-base" onClick={goToNextStep}>
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        key="submit"
                        type="submit"
                        size="lg"
                        className="h-12 flex-1 text-base"
                        disabled={form.formState.isSubmitting || isPending}
                      >
                        {form.formState.isSubmitting || isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Agendar agora"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </Form>
          </div>

          {/* 🔹 RESUMO LATERAL */}
          {/* Só no desktop: no celular ele caía abaixo do formulário e, com o preço
              em destaque, roubava a atenção do botão de continuar (5 testes). */}
          <aside className="hidden xl:block space-y-6 xl:sticky xl:top-6 self-start">
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
                        {selectedService?.titulo || "Ainda não selecionado"}
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
                        {selectedProfessional?.nome || "Ainda não selecionado"}
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

                {selectedService?.preco && adicionaisEscolhidos.length === 0 && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {selectedService.precoAPartirDe ? "Valor a partir de" : "Valor do serviço"}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-foreground">
                      R$ {Number(selectedService.preco).toFixed(2)}
                    </p>
                    {selectedService.precoAPartirDe && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        O valor final depende do que você escolher; combinamos no atendimento.
                      </p>
                    )}
                  </div>
                )}

                {adicionaisEscolhidos.length > 0 && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                    {temPreco && (
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{selectedService?.titulo}</span>
                        <span className="font-medium text-foreground">{formatarReais(precoDoServico)}</span>
                      </div>
                    )}

                    {adicionaisEscolhidos.map((a) => (
                      <div key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {a.unidade ? `${a.nome} × ${a.quantidade}` : a.nome}
                        </span>
                        <span className="font-medium text-foreground">+ {formatarReais(a.total)}</span>
                      </div>
                    ))}

                    <div className="border-t border-border pt-2">
                      {temPreco ? (
                        <>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{rotuloTotal}</p>
                          <p className="mt-1 text-2xl font-bold text-foreground">{formatarReais(totalEstimado)}</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-foreground">
                          Adicionais: + {formatarReais(totalAdicionais)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">O valor final é confirmado no atendimento.</p>
                    </div>
                  </div>
                )}

                {selectedService?.descricao && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sobre este serviço</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{selectedService.descricao}</p>
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

                    {/* Resumo é só leitura: os campos ficam na etapa 3 */}
                    <ul className="space-y-1 text-sm">
                      {documents.map((doc) => {
                        const item = documentValues[doc.id]
                        const filled = Boolean(item?.text || item?.file)

                        return (
                          <li key={doc.id} className="flex items-center gap-2">
                            <CheckCircle2
                              className={cn("h-4 w-4 shrink-0", filled ? "text-success" : "text-muted-foreground/40")}
                            />
                            <span className={filled ? "text-foreground" : "text-muted-foreground"}>
                              {doc.label}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary shrink-0" />
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
                    <Clock className="mt-0.5 h-4 w-4 text-primary shrink-0" />
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
