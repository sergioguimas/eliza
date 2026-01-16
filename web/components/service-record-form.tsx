'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createServiceRecord } from "@/app/actions/service-records"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, Save } from "lucide-react"
import { toast } from "sonner"

interface ServiceRecordFormProps {
  customerId: string
}

export function ServiceRecordForm({ customerId }: ServiceRecordFormProps) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(status: 'draft' | 'signed') {
    if (!content.trim()) {
      toast.warning("O conteúdo do registro não pode estar vazio.")
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('customer_id', customerId)
    formData.append('content', content)
    formData.append('status', status)

    const result = await createServiceRecord(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success(status === 'signed' ? "Registro assinado com sucesso!" : "Rascunho salvo.")
      setContent("") // Limpa o campo
      router.refresh() // Atualiza a lista abaixo
    }
    setIsSubmitting(false)
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-700 dark:text-gray-200">
          Novo Registro de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Descreva os detalhes do atendimento, observações técnicas ou notas internas..."
          className="min-h-[120px] mb-4 resize-none focus-visible:ring-blue-500"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
        />
        
        <div className="flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="text-gray-600"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Rascunho
          </Button>
          
          <Button 
            onClick={() => handleSubmit('signed')}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Assinar e Finalizar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}