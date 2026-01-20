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
      toast.warning("O conteúdo não pode estar vazio.")
      return
    }

    setIsSubmitting(true)
    
    const formData = new FormData()
    formData.append('customer_id', customerId)
    formData.append('content', content)

    const result = await createServiceRecord(formData)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Registro salvo com sucesso!")
      setContent("") // Limpa o campo
      router.refresh()
    }
    
    setIsSubmitting(false)
  }

  return (
    <Card className="border-l-6 border-l-blue-500 mb-8">
      <CardHeader className="pb-1 bg-gray-50/50">
        <CardTitle className="text-base font-semibold text-gray-700">
          Novo Registro de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <Textarea
          placeholder="Descreva os detalhes da evolução, atendimento ou observações..."
          className="min-h-[120px] mb-4 resize-none bg-white"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isSubmitting}
        />
        
        <div className="flex items-center justify-end gap-3">
          <Button 
            onClick={() => handleSubmit('draft')}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Registro
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}