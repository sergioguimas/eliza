'use client'

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { 
  Lock, LockOpen, Printer, Share2, Pencil, Trash2, CheckCircle, FileText, Loader2, 
  Send,
  SendHorizonal,
  Download
} from "lucide-react"
import { toast } from "sonner"
import { updateServiceRecord, signServiceRecord, deleteServiceRecord, ServiceRecord } from "@/app/actions/service-records"
import { sendWhatsAppMedia } from "@/app/actions/send-whatsapp"
import { jsPDF } from "jspdf"
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

interface ServiceRecordListProps {
    records: ServiceRecord[]
    customerId: string
    customerPhone?: string
    organizationId: string
    initialRecords: ServiceRecord[]
}

export function ServiceRecordList({ records, customerId, customerPhone, organizationId, initialRecords }: ServiceRecordListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [sendingId, setSendingId] = useState<string | null>(null) // Estado de carregamento do envio

  // --- Handlers ---
  const startEditing = (rec: ServiceRecord) => {
    setEditingId(rec.id)
    setEditContent(rec.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent("")
  }

  const saveEdit = async (id: string) => {
    const res = await updateServiceRecord(id, editContent, customerId)
    if (res?.error) toast.error(res.error)
    else toast.success("Registro atualizado!")
    setEditingId(null)
  }

  const handleSign = async (id: string) => {
    const res = await signServiceRecord(id, customerId)
    if (res?.error) toast.error(res.error)
    else toast.success("Registro assinado e finalizado!")
  }

  const handleDelete = async (id: string) => {
    const res = await deleteServiceRecord(id, customerId)
    if (res?.error) toast.error(res.error)
    else toast.success("Registro removido.")
  }

  const handlePrintCard = (id: string) => {
    window.open(`/print/record/${id}`, '_blank')
  }

  // 👇 NOVA LÓGICA DE ENVIO DE PDF VIA WHATSAPP
  const handleSendWhatsappPDF = async (record: ServiceRecord) => {
    if (!customerPhone) {
        toast.error("Cliente sem telefone cadastrado.")
        return
    }

    setSendingId(record.id)
    toast.info("Gerando PDF e enviando...")

    try {
        // 1. Gera o PDF programaticamente
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
            phone: customerPhone,
            caption: `Olá! Segue o PDF do seu registro de atendimento do dia ${format(new Date(record.created_at), "dd/MM/yyyy")}.`,
            media: pdfBase64,
            fileName: `atendimento_${format(new Date(record.created_at), "dd-MM-yyyy")}.pdf`,
            organizationId: organizationId
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


  // --- Render ---
  if (!records || records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50/50">
        <FileText className="h-10 w-10 mb-2 opacity-50" />
        <p>Nenhum registro encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {records.map((record) => {
        const isSigned = record.status === 'signed'
        const isEditing = editingId === record.id
        const isSending = sendingId === record.id

        return (
          <Card key={record.id} className={`overflow-hidden border-l-16 transition-all ${
            isSigned ? 'border-l-green-500 bg-green-50' : 'border-l-amber-400 bg-amber-50'
          }`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                
                {/* ESQUERDA: Data e Autor */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isSigned ? "default" : "secondary"} className={isSigned ? "bg-green-600 hover:bg-green-700" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                      {isSigned ? <><Lock className="h-3 w-3 mr-1" /> Assinado</> : <><LockOpen className="h-3 w-3 mr-1" /> Rascunho</>}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(record.created_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {record.professional && (
                     <span className="text-xs text-muted-foreground mt-1 ml-1">
                       Por: {record.professional.full_name}
                     </span>
                  )}
                </div>

                {/* DIREITA: Botões de Ação */}
                <div className="flex items-center gap-1">
                   {/* 1. Botões Públicos (Sempre visíveis) */}
                   <Button 
                        variant="default"
                        size="icon"
                        onClick={() => handlePrintCard(record.id)}
                        className={"bg-blue-300 hover:bg-blue-700"}
                        title="Salvar Histórico">
                     <Download className="h-4 w-4" />
                   </Button>
                   
                   <Button 
                        variant="default" 
                        size="icon" 
                        onClick={() => handleSendWhatsappPDF(record)} 
                        className={isSending ? "opacity-70" : "bg-green-300 hover:bg-green-700"}
                        title={customerPhone ? "Enviar PDF no WhatsApp" : "Cliente sem telefone"}>
                     {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                   </Button>
                   
                   {/* 2. Botões Restritos */}
                   {!isSigned && !isEditing && (
                     <>
                       <div className="w-px h-4 bg-gray-300 mx-1" /> 
                       
                       <Button
                            variant="default"
                            size="icon"
                            onClick={() => startEditing(record)}
                            className="bg-yellow-200 hover:bg-yellow-700"
                            title="Editar">
                         <Pencil className="h-4 w-4" />
                       </Button>
                       
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir rascunho?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(record.id)} className="bg-red-600">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                       </AlertDialog>
                     </>
                   )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isEditing ? (
                <div className="space-y-3 animate-in fade-in">
                   <Textarea 
                      value={editContent} 
                      onChange={(e) => setEditContent(e.target.value)} 
                      className="min-h-[100px] bg-white border-blue-200 focus-visible:ring-blue-500"
                   />
                   <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={cancelEditing}>Cancelar</Button>
                      <Button size="sm" onClick={() => saveEdit(record.id)}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Salvar
                      </Button>
                   </div>
                </div>
              ) : (
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {record.content}
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-0 flex justify-end">
              {!isSigned ? (
                 !isEditing && (
                   <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 mt-2">
                           <CheckCircle className="w-4 h-4 mr-2" /> Assinar e Finalizar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Assinar Registro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Ao assinar, o registro será bloqueado para edições futuras.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleSign(record.id)} className="bg-green-600">
                            Confirmar Assinatura
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                   </AlertDialog>
                 )
              ) : (
                <div className="text-[10px] text-gray-400 font-mono text-right w-full border-t pt-2 mt-2">
                   Assinado digitalmente por {record.signed_by === record.professional?.full_name ? 'autor' : 'profissional'} em {format(new Date(record.signed_at!), "dd/MM/yyyy HH:mm")}
                   <br />ID: {record.id.slice(0,8)}... • Hash: {record.signature_hash?.slice(0, 10)}...
                </div>
              )}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}