'use client'

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon, CheckCircle2, Clock, Loader2, User, AlertCircle } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Actions e Tipos
import { createAppointment } from "@/app/actions/create-appointment"
import { getAvailableSlots } from "@/app/actions/get-available-slots"
import { Database } from "@/utils/database.types"

// Schema de validação Zod corrigido
const formSchema = z.object({
  organization_id: z.string(),
  service_id: z.string().min(1, "Selecione um serviço"),
  professional_id: z.string().min(1, "Selecione um profissional"),
  date: z.date().refine(val => val !== null, "Selecione uma data"),
  time: z.string().min(1, "Selecione um horário"),
  customer_name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  customer_phone: z.string().min(10, "Informe um telefone válido com DDD"),
  notes: z.string().optional(),
  customer_document: z.string().min(11, "Documento inválido (mínimo 11 caracteres)"),
  customer_birth_date: z.string().min(10, "Data de nascimento obrigatória"),
  customer_gender: z.string().min(1, "Selecione o gênero"),
})

interface PublicBookingFormProps {
  organizationId: string
  services: Database['public']['Tables']['services']['Row'][]
  professionals: Database['public']['Tables']['professionals']['Row'][]
}

export function PublicBookingForm({ organizationId, services, professionals }: PublicBookingFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      organization_id: organizationId,
      customer_name: "",
      customer_phone: "",
      customer_document: "",
      customer_birth_date: "",
      customer_gender: undefined,
      notes: "",
      service_id: "",
      professional_id: "",
      time: "",
    },
  })

  const phoneMask = (value: string) => {
    if (!value) return ""
    value = value.replace(/\D/g, "") // Remove tudo que não é número
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2") // Coloca parênteses no DDD
    value = value.replace(/(\d{5})(\d)/, "$1-$2") // Coloca o hífen
    return value.substring(0, 15) // Limita o tamanho
  }

  // Observadores para busca de horários
  const selectedDate = form.watch("date")
  const selectedProf = form.watch("professional_id")

  // Efeito para carregar horários disponíveis dinamicamente
  useEffect(() => {
    async function updateSlots() {
      if (selectedDate && selectedProf) {
        setLoadingSlots(true)
        try {
          const available = await getAvailableSlots(selectedProf, selectedDate, organizationId)
          setSlots(available)
          form.setValue("time", "") // Reseta o horário ao mudar data/médico
        } catch (error) {
          toast.error("Erro ao carregar horários disponíveis.")
        } finally {
          setLoadingSlots(false)
        }
      }
    }
    updateSlots()
  }, [selectedDate, selectedProf, organizationId, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsPending(true)
    
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
    formData.append('customer_birth_date', values.customer_birth_date)
    formData.append('customer_gender', values.customer_gender)
    formData.append('customer_phone', phoneWithDDI)
    formData.append('notes', values.notes || "")
    formData.append('source', 'public')   

    const result = await createAppointment(formData)

    if (result?.success) {
      setIsSuccess(true)
      if (result.foundName) {
        toast.success(`Cadastro localizado: ${result.foundName}`)
      }
      toast.success("Solicitação enviada com sucesso!")
    } else {
      toast.error(result?.error || "Erro ao solicitar agendamento.")
      setIsPending(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 transition-all animate-in fade-in zoom-in">
        <CardContent className="pt-10 pb-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Solicitação Enviada!</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Olá <strong>{form.getValues("customer_name")}</strong>, recebemos seu pedido. 
            Aguarde a confirmação que será enviada para o seu WhatsApp.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
            Realizar novo agendamento
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="border-border bg-card">
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Serviço */}
              <FormField
                control={form.control}
                name="service_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serviço</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="O que deseja realizar?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services.map(s => (
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

              {/* Profissional */}
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
                        {professionals.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Data */}
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
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP", { locale: ptBR }) : <span>Selecione o dia</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => field.onChange(date)}
                          disabled={(date) => date < new Date() || date.getDay() === 0}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Horário Dinâmico */}
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário Disponível</FormLabel>
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
                            <SelectValue placeholder={slots.length > 0 ? "Escolha a hora" : "Selecione data/profissional"} />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {slots.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {slots.length === 0 && selectedDate && !loadingSlots && (
                      <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Sem horários para este dia.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Seus Dados de Contato</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl><Input placeholder="Nome Completo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Documento (CPF ou RG) */}
              <FormField
                control={form.control}
                name="customer_document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento</FormLabel>
                    <FormControl>
                      <Input placeholder="CPF ou Documento" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Data de Nascimento */}
              <FormField
                control={form.control}
                name="customer_birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              {/* Telefone */}
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
              {/* Gênero */}
              <FormField
                control={form.control}
                name="customer_gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gênero</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
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
                  <FormControl>
                    <Input placeholder="Observações adicionais (opcional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-lg font-bold transition-all" disabled={isPending}>
          {isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando solicitação...</> : "Confirmar Pré-Agendamento"}
        </Button>
      </form>
    </Form>
  )
}