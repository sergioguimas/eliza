'use client'

import { useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { 
  Lock, LockOpen, Printer, Share2, Pencil, Trash2, CheckCircle, FileText 
} from "lucide-react"
import { toast } from "sonner"
import { updateServiceRecord, signServiceRecord, deleteServiceRecord, ServiceRecord } from "@/app/actions/service-records"
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

export function ServiceRecordList({ records, customerId }: { records: ServiceRecord[], customerId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")

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

  const shareWhatsapp = (content: string) => {
    const text = encodeURIComponent(`*Registro de Atendimento*\n\n${content}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handlePrintHistory = (id: string) => {
    window.open(`/print/history/${id}`, '_blank')
  }

  const handlePrintCard = (id: string) => {
    window.open(`/print/record/${id}`, '_blank')
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

        return (
          <Card key={record.id} className={`overflow-hidden border-l-4 transition-all ${
            isSigned ? 'border-l-green-500 bg-white' : 'border-l-amber-400 bg-amber-50/30'
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
                   <Button variant="default" size="icon" onClick={() => handlePrintCard(record.id)} title="Imprimir Histórico">
                     <Printer className="h-4 w-4" />
                   </Button>
                   <Button variant="default" size="icon" onClick={() => shareWhatsapp(record.content)} title="Enviar no Zap">
                     <Share2 className="h-4 w-4" />
                   </Button>
                   
                   {/* 2. Botões Restritos (Apenas se NÃO for assinado e NÃO estiver editando) */}
                   {!isSigned && !isEditing && (
                     <>
                       <div className="w-px h-4 bg-gray-300 mx-1" /> {/* Divisor */}
                       
                       <Button variant="default" size="icon" onClick={() => startEditing(record)} title="Editar">
                         <Pencil className="h-4 w-4" />
                       </Button>
                       
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
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