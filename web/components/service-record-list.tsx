'use client'

import { useState, useMemo } from "react"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { 
  Lock, LockOpen, Pencil, Trash2, CheckCircle, FileText, Loader2, 
  SendHorizonal, Download, Search, X, Calendar as CalendarIcon, Link2Icon as LinkIcon
} from "lucide-react"
import { toast } from "sonner"
import { 
  updateServiceRecord, 
  signServiceRecord, 
  deleteServiceRecord, 
  linkRecordToAppointment,
  ServiceRecord 
} from "@/app/actions/service-records"
import { DateRange } from "react-day-picker"
import { jsPDF } from "jspdf"
import { sendWhatsAppMedia } from "@/app/actions/send-whatsapp"

const TAG_COLORS: Record<string, string> = {
  'Evolução': 'bg-blue-100 text-blue-700 border-blue-200',
  'Prescrição': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Exame': 'bg-purple-100 text-purple-700 border-purple-200',
  'Anamnese': 'bg-amber-100 text-amber-700 border-amber-200',
  'Encaminhamento': 'bg-slate-100 text-slate-700 border-slate-200',
};

interface ServiceRecordItemProps {
  record: ServiceRecord;
  availableAppointments: any[];
  customer: {
    id: string;
    phone?: string | null;
    full_name: string;
    organization_id: string;
  };
}

// --- Componente de Item Individual (Card) ---
function ServiceRecordItem({ record, availableAppointments, customer }: ServiceRecordItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(record.content)
  const [isSaving, setIsSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const isSending = sendingId === record.id

  const handleUpdate = async () => {
    setIsSaving(true)
    const res = await updateServiceRecord(record.id, editedContent, customer.id)
    if (res.success) {
      toast.success("Registro atualizado")
      setIsEditing(false)
    } else {
      toast.error("Erro ao atualizar")
    }
    setIsSaving(false)
  }

  const handleSign = async () => {
    const res = await signServiceRecord(record.id, customer.id)
    if (res.success) {
      toast.success("Registro assinado com sucesso!")
    } else {
      toast.error("Erro ao assinar")
    }
  }

  const handleLink = async (appointmentId: string) => {
    const res = await linkRecordToAppointment(record.id, appointmentId)
    if (res.success) {
      toast.success("Vínculo realizado com sucesso!")
    } else {
      toast.error("Erro ao vincular")
    }
  }

  const handleDownloadPDF = () => {
    window.open(`/print/record/${record.id}`, '_blank')
  }

  const handleSendWhatsappPDF = async (record: ServiceRecord) => {
    if (!customer.phone) {
        toast.error("Cliente sem telefone cadastrado.")
        return
    }

    setSendingId(record.id)
    toast.info("Gerando PDF e enviando...")

    try {
        // 1. Gera o PDF
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()
        
        // Cabeçalho
        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.text("Registro de Atendimento", 20, 20)

        // Metadados
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.text(`Data: ${format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm")}`, 20, 30)
        if (record.professional?.full_name) {
            doc.text(`Profissional: ${record.professional.full_name}`, 20, 35)
        }
        doc.text(`Status: ${record.status === 'signed' ? 'Assinado/Finalizado' : 'Rascunho'}`, 20, 40)

        // Linha divisória
        doc.setLineWidth(0.5)
        doc.line(20, 45, pageWidth - 20, 45)

        // Conteúdo (Com quebra de linha automática)
        doc.setFontSize(11)
        const splitText = doc.splitTextToSize(record.content, pageWidth - 40)
        doc.text(splitText, 20, 55)

        // Rodapé se assinado
        if (record.status === 'signed' && record.signed_at) {
            const finalY = 60 + (splitText.length * 5)
            doc.setFontSize(8)
            doc.setTextColor(100)
            doc.text(`Assinado digitalmente em ${format(new Date(record.signed_at), "dd/MM/yyyy HH:mm")}`, 20, finalY + 10)
            doc.text(`ID do Registro: ${record.id}`, 20, finalY + 15)
        }

        // 2. Converte para Base64 (Sem o prefixo data:application/pdf...)
        const pdfBase64 = doc.output('datauristring').split(',')[1]

        // 3. Envia para a API
        const result = await sendWhatsAppMedia({
            phone: customer.phone,
            caption: `Olá! Segue o PDF do seu registro de atendimento do dia ${format(new Date(record.created_at), "dd/MM/yyyy")}.`,
            media: pdfBase64,
            fileName: `atendimento_${format(new Date(record.created_at), "dd-MM-yyyy")}.pdf`,
            organizationId: customer.organization_id
        })

        if (result.success) {
            toast.success("PDF enviado para o WhatsApp do cliente!")
        } else {
            toast.error("Erro ao enviar mensagem.")
        }

    } catch (error) {
        console.error(error)
        toast.error("Erro ao gerar ou enviar documento.")
    } finally {
        setSendingId(null)
    }
  }

  return (
    <Card className={cn(
      "overflow-hidden border-l-16 transition-all",
      record.signature_hash ? "border-l-green-500 bg-green-100" : "border-l-amber-400 bg-amber-100"
    )}>
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-center gap-2">
          <Badge variant={record.signature_hash ? "default" : "secondary"} className={record.signature_hash ? "bg-green-600 hover:bg-green-700" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
            {record.signature_hash ? <><Lock className="h-3 w-3 mr-1" /> Assinado</> : <><LockOpen className="h-3 w-3 mr-1" /> Rascunho</>}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-medium ml-1">
            Criado em {format(new Date(record.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {record.tags?.map(tag => (
              <span
                key={tag}
                className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-tight",
                  TAG_COLORS[tag] || "bg-gray-100 text-gray-600 border-gray-200")}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea 
              value={editedContent} 
              onChange={(e) => setEditedContent(e.target.value)}
              className="text-sm min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar Alteração"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
            {record.content}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-3 border-t bg-zinc-50/50">
        <div className="flex items-center justify-between w-full">
          {/* Vínculo com Consulta */}
          <div className="flex items-center gap-2">
            {record.appointment_id ? (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold bg-emerald-100/50 px-2 py-1 rounded border border-emerald-200">
                <CalendarIcon className="h-3 w-3" />
                CONSULTA: {format(new Date(record.appointment?.start_time || record.created_at), "dd/MM/yy HH:mm")}
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-amber-700 hover:bg-amber-100 border border-dashed border-amber-300">
                    <LinkIcon className="h-3 w-3" />
                    VINCULAR ATENDIMENTO
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[250px]">
                  <DropdownMenuLabel className="text-[10px] uppercase opacity-60">Consultas disponíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableAppointments?.filter(a => a.status === 'completed').length > 0 ? (
                    availableAppointments
                      .filter(a => a.status === 'completed')
                      .map(appt => (
                        <DropdownMenuItem key={appt.id} onClick={() => handleLink(appt.id)} className="text-xs">
                          <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                          {format(new Date(appt.start_time), "dd/MM/yy HH:mm")} - {appt.services?.title}
                        </DropdownMenuItem>
                      ))
                  ) : (
                    <div className="p-3 text-[10px] text-center text-muted-foreground italic">
                      Nenhuma consulta finalizada encontrada.
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Ações do Registro */}
          <div className="flex flex-wrap items-center gap-2">
            {!record.signature_hash && (
              <>
                {/* Botão Assinar */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                      <LockOpen className="h-4 w-4" />
                      <span className="hidden sm:inline">Assinar</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Assinar Registro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ao assinar, este registro será bloqueado para edições.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSign} className="bg-emerald-600">Assinar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Botão Editar */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-2 text-zinc-500" 
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>

                {/* Botão Excluir */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 gap-2 text-red-500" 
                  onClick={() => deleteServiceRecord(record.id, customer.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </>
            )}
            {/* Botão Download */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-2 text-blue-600" 
              onClick={handleDownloadPDF}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>

            {/* Botão WhatsApp */}
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => handleSendWhatsappPDF(record)} 
              disabled={!customer.phone || isSending}
              className={cn(
                "h-8 gap-2 ml-auto",
                isSending ? "opacity-70" : "bg-emerald-600 hover:bg-emerald-700"
              )}
              title={customer.phone ? "Enviar PDF no WhatsApp" : "Cliente sem telefone"}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              <span className="text-xs">Enviar WhatsApp</span>
            </Button>
          </div>
        </div>

        {record.signature_hash && (
          <div className="w-full flex items-center justify-between text-[9px] text-zinc-500 pt-2 border-t border-zinc-200/50 italic">
            <span>Assinado por {record.professional?.full_name || 'Profissional'}</span>
            <span className="font-mono">HASH: {record.signature_hash.slice(0, 12)}...</span>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

// --- Componente Principal ---
export function ServiceRecordList({ 
  records, 
  availableAppointments,
  customer
}: { 
  records: ServiceRecord[], 
  availableAppointments: any[],
  customer: any 
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const categories = ['Evolução', 'Prescrição', 'Exame', 'Anamnese', 'Encaminhamento']

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      const matchesText = record.content.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = activeCategory ? record.tags?.includes(activeCategory) : true
      
      let matchesDate = true
      if (dateRange?.from) {
        const recordDate = new Date(record.created_at)
        const start = startOfDay(dateRange.from)
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        matchesDate = isWithinInterval(recordDate, { start, end })
      }

      return matchesText && matchesCategory && matchesDate
    })
  }, [records, searchTerm, activeCategory, dateRange])

  return (
    <div className="space-y-6">
      {/* Barra de Filtros */}
      <div className="flex flex-col gap-4 bg-zinc-900 p-4 rounded-xl border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar no prontuário..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("sm:w-[240px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}` : format(dateRange.from, "dd/MM/yyyy")
                ) : "Filtrar por data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            variant={activeCategory === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveCategory(null)}
            className="text-xs h-8 rounded-full"
          >
            Todos
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className="text-xs h-8 rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid gap-4">
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <ServiceRecordItem 
              key={record.id} 
              record={record} 
              availableAppointments={availableAppointments} 
              customer={customer}
            />
          ))
        ) : (
          <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-zinc-50/50">
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado para esses filtros.</p>
          </div>
        )}
      </div>
    </div>
  )
}