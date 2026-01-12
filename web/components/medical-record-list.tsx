'use client'

import { useState } from "react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  Lock, PenSquare, FileSignature, ShieldCheck, 
  Trash2, Save, X, Printer 
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import { signMedicalRecord } from "@/app/actions/sign-medical-record"
import { updateMedicalRecord } from "@/app/actions/update-medical-record"
import { deleteMedicalRecord } from "@/app/actions/delete-medical-record"
import { useKeckleon } from "@/providers/keckleon-provider"

type MedicalRecord = {
  id: string
  content: string
  created_at: string | null
  status: 'draft' | 'signed' | string | null
  signed_at: string | null
  professional: { full_name: string | null}
}

export function MedicalRecordList({ records, customerId }: { records: any[], customerId: string }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [loading, setLoading] = useState(false)
  const { dict } = useKeckleon()

  // --- HANDLERS ---

  function startEditing(record: MedicalRecord) {
    setEditingId(record.id)
    setEditContent(record.content)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditContent("")
  }

  async function handleSave(recordId: string) {
    setLoading(true)
    const result = await updateMedicalRecord(recordId, editContent)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Alteração salva!")
      setEditingId(null)
    }
  }

  async function handleDelete(recordId: string) {
    if (!confirm("Tem certeza? Essa ação não pode ser desfeita.")) return

    setLoading(true)
    const result = await deleteMedicalRecord(recordId)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Rascunho excluído.")
    }
  }

  async function handleSign(recordId: string) {
    if (!confirm("Atenção: Ao finalizar, este documento será travado permanentemente.")) return
    
    if (editingId === recordId) {
      await updateMedicalRecord(recordId, editContent)
    }

    const result = await signMedicalRecord(recordId, customerId)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Prontuário assinado e travado!")
      setEditingId(null)
    }
  }

  function handlePrint(record: MedicalRecord) {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${dict.label_prontuario} - ${format(new Date(), 'dd/MM/yyyy')}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; color: #333; }
              .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
              .meta { font-size: 12px; color: #666; margin-bottom: 40px; }
              .content { white-space: pre-wrap; line-height: 1.6; font-size: 14px; }
              .footer { margin-top: 50px; border-top: 1px solid #ccc; padding-top: 20px; text-align: center; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${dict.label_prontuario}</h1>
              <p>Paciente ID: ${customerId}</p>
            </div>
            <div class="meta">
              <p><strong>${dict.label_profissional}:</strong> ${record.professional?.full_name || "Padrão"}</p>
              <p><strong>Data Original:</strong> ${record.created_at ? format(parseISO(record.created_at), "dd/MM/yyyy HH:mm") : '-'}</p>
              <p><strong>Assinado eletronicamente em:</strong> ${record.signed_at ? format(parseISO(record.signed_at), "dd/MM/yyyy HH:mm") : 'Não assinado'}</p>
            </div>
            <div class="content">${record.content}</div>
            <div class="footer">
              Gerado via SaaS Agendamento - Documento Interno
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  // --- RENDER ---

  if (!records?.length) {
    return (
      <div className="text-center py-8 border border-border border-dashed rounded-lg">
        <p className="text-zinc-500 text-sm">Nenhuma anotação registrada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {records.map((record: MedicalRecord) => {
        const isEditing = editingId === record.id
        const isSigned = record.status === 'signed'

        return (
          <Card key={record.id} className={`bg-background border-border ${isSigned ? 'border-l-emerald-500 border-l-4' : 'border-l-yellow-500 border-l-4'}`}>
            
            {/* HEADER */}
            <CardHeader className="py-3 px-4 border-b border-border/50 bg-zinc-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-blue-900 text-blue-200">DR</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-bold text-zinc-300">Dr. Padrão</span>
                  
                  {isSigned ? (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 text-[10px] h-5 gap-1">
                      <Lock className="w-3 h-3" /> Assinado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 text-[10px] h-5 gap-1">
                      <PenSquare className="w-3 h-3" /> Rascunho
                    </Badge>
                  )}
                </div>
                
                <span className="text-xs text-zinc-500">
                  {record.created_at && format(parseISO(record.created_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            </CardHeader>
            
            {/* CONTENT */}
            <CardContent className="p-4 text-sm text-zinc-300">
              {isEditing ? (
                <Textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-zinc-950 border-zinc-700 min-h-[150px] focus:ring-yellow-500/50"
                />
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">{record.content}</div>
              )}
            </CardContent>

            {/* FOOTER ACTION BAR */}
            <CardFooter className="py-2 px-4 bg-zinc-950/50 flex justify-between items-center">
              
              {/* Lado Esquerdo: Ações Destrutivas */}
              <div>
                {!isSigned && !isEditing && (
                  <Button 
                    onClick={() => handleDelete(record.id)} 
                    variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-red-400 hover:bg-red-950/30">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Lado Direito: Ações Principais */}
              <div className="flex items-center gap-2">
                
                {isSigned ? (
                  // AÇÕES PARA ASSINADOS
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-400 hover:text-blue-400 hover:bg-blue-900/20"
                    title={`Imprimir ${dict.label_prontuario}`}
                    onClick={() => window.open(`/print/record/${record.id}`, '_blank')} // Abre em nova aba
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                ) : (
                  // AÇÕES PARA RASCUNHOS
                  <>
                    {isEditing ? (
                      <>
                        <Button onClick={cancelEditing} variant="ghost" size="sm" className="h-7 text-xs" disabled={loading}>
                          <X className="w-3 h-3 mr-1" /> Cancelar
                        </Button>
                        <Button onClick={() => handleSave(record.id)} size="sm" className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-white gap-1" disabled={loading}>
                          <Save className="w-3 h-3" /> Salvar Edição
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => startEditing(record)} variant="ghost" size="sm" className="h-7 text-xs hover:bg-zinc-800">
                          Editar
                        </Button>
                        <Button onClick={() => handleSign(record.id)} size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                          <FileSignature className="w-3 h-3" /> Finalizar
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}