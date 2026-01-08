'use client'

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { saveDraft, signRecord, deleteRecord } from "@/app/actions/medical-records"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Loader2, Save, CheckCircle, Printer, Trash2, Lock, FileText } from "lucide-react"

interface MedicalRecordFormProps {
  customer_id: string
  record?: any
  professionalName?: string
}

export function MedicalRecordForm({ customer_id, record, professionalName }: MedicalRecordFormProps) {
  const [content, setContent] = useState(record?.content || "")
  const [isPending, startTransition] = useTransition()
  
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
        toast.success("Rascunho salvo com sucesso!")
        if(isNew) setContent("") 
      } catch (error) {
        toast.error("Erro ao salvar.")
      }
    })
  }

  const handleSign = () => {
    if (!record?.id) return toast.error("Salve o rascunho antes de finalizar.")
    if(!confirm("Ao finalizar, este registro não poderá mais ser editado. Confirmar?")) return

    startTransition(async () => {
      try {
        await signRecord(record.id, customer_id)
        toast.success("Registro finalizado!")
      } catch (error) {
        toast.error("Erro ao finalizar.")
      }
    })
  }

  const handleDelete = () => {
    if(!confirm("Tem certeza que deseja excluir este item?")) return
    startTransition(async () => {
      await deleteRecord(record.id, customer_id)
      toast.success("Item excluído.")
    })
  }

  const handlePrint = () => {
    window.open(`/print/record/${record.id}`, '_blank')
  }

  return (
    <Card className={`mb-4 border-l-4 ${isSigned ? 'border-l-green-500' : 'border-l-blue-400'}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {isSigned ? <Lock className="h-4 w-4 text-green-600"/> : <FileText className="h-4 w-4 text-blue-500"/>}
            {isNew ? "Novo Registro / Anotação" : 
              `Registro de ${format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
            }
          </CardTitle>
          {isSigned && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isSigned ? (
          <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-md whitespace-pre-wrap text-foreground">
            {record.content}
          </div>
        ) : (
          <Textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descreva os detalhes do atendimento, serviços realizados ou observações..."
            className="min-h-[150px] bg-background resize-none"
          />
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-2">
        {isSigned ? (
          <div className="text-xs text-muted-foreground w-full text-right">
            Finalizado por <strong>{professionalName || "Profissional"}</strong> em {format(new Date(record.signed_at), "dd/MM/yyyy HH:mm")}
          </div>
        ) : (
          <>
             {!isNew ? (
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </Button>
             ) : <div></div>}

             <div className="flex gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Rascunho
                </Button>
                
                {!isNew && (
                  <Button onClick={handleSign} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Registro
                  </Button>
                )}
             </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}