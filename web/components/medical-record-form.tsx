'use client'

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { saveDraft, signRecord, deleteRecord } from "@/app/actions/medical-records"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Loader2, Save, CheckCircle, Printer, Trash2, Lock, FileText, Calendar } from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

interface MedicalRecordFormProps {
  customer_id: string
  record?: any
  professionalName?: string
}

export function MedicalRecordForm({ customer_id, record, professionalName }: MedicalRecordFormProps) {
  const [content, setContent] = useState(record?.content || "")
  const [isPending, startTransition] = useTransition()
  const { dict } = useKeckleon()
  
  const isNew = !record?.id
  const isSigned = record?.status === 'signed'

  const handleSaveDraft = () => {
    if (!content.trim()) return toast.error("O campo está vazio.")

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('customer_id', customer_id)
        formData.append('content', content)
        if (record?.id) formData.append('id', record.id)

        await saveDraft(formData)
        toast.success("Rascunho salvo!")
        if(isNew) setContent("") 
      } catch (error) {
        toast.error("Erro ao salvar.")
      }
    })
  }

  const handleSign = () => {
    if (!record?.id) return toast.error("Salve antes de finalizar.")
    if(!confirm("Ao finalizar, não será possível editar. Confirmar?")) return

    startTransition(async () => {
      try {
        await signRecord(record.id, customer_id)
        toast.success("Finalizado!")
      } catch (error) {
        toast.error("Erro ao assinar.")
      }
    })
  }

  const handleDelete = () => {
    if(!confirm("Excluir este item?")) return
    startTransition(async () => {
      await deleteRecord(record.id, customer_id)
      toast.success("Excluído.")
    })
  }

  const handlePrint = () => {
    window.open(`/print/record/${record.id}`, '_blank')
  }

  const borderClass = isNew ? 'border-l-blue-500' : (isSigned ? 'border-l-green-500' : 'border-l-orange-400')

  return (
    <Card className={`mb-3 border shadow-sm ${borderClass}`}>
      <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
            {isSigned ? (
                <Lock className="h-4 w-4 text-green-600" />
            ) : (
                isNew ? <FileText className="h-4 w-4 text-blue-500"/> : <FileText className="h-4 w-4 text-orange-400"/>
            )}
            
            <span className="text-sm font-semibold text-foreground">
                {isNew ? `Novo(a) ${dict.label_prontuario}` : format(new Date(record.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </span>
        </div>

        {isSigned && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir
            </Button>
        )}
      </CardHeader>
      
      <CardContent className="p-3 pt-1">
        {isSigned ? (
          <div className="text-sm text-foreground bg-muted/40 p-3 rounded-md whitespace-pre-wrap leading-relaxed border-0">
            {record.content}
          </div>
        ) : (
          <Textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Escreva aqui os detalhes do(a) ${dict.label_prontuario}...`}
            className="min-h-[100px] text-sm bg-background resize-y"
          />
        )}
      </CardContent>

      {/* FOOTER: Botões compactos (h-8) */}
      <CardFooter className="p-3 pt-0 flex justify-between items-center">
        {isSigned ? (
          <div className="text-xs text-muted-foreground w-full text-right flex items-center justify-end gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            Finalizado por <span className="font-medium text-foreground">{professionalName || "Profissional"}</span>
          </div>
        ) : (
          <>
             {!isNew ? (
                <Button variant="ghost" size="sm" onClick={handleDelete} className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
             ) : <div />}

             <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isPending} className="h-8 px-3 text-xs md:text-sm">
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Salvar Rascunho
                </Button>
                
                {!isNew && (
                  <Button size="sm" onClick={handleSign} disabled={isPending} className="h-8 px-3 text-xs md:text-sm bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Finalizar
                  </Button>
                )}
             </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}