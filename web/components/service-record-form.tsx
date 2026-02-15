'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createServiceRecord } from "@/app/actions/service-records"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, CheckCircle2, Loader2, Lock, Save, TagIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const AVAILABLE_TAGS = [
  { label: 'Evolução', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' },
  { label: 'Prescrição', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
  { label: 'Exame', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200' },
  { label: 'Anamnese', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200' },
  { label: 'Encaminhamento', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200' }
]

interface ServiceRecordFormProps {
  customerId: string
  organizationId: string
  defaultAppointmentId?: string | null
}

export function ServiceRecordForm({ customerId, organizationId, defaultAppointmentId }: ServiceRecordFormProps) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>(['Evolução'])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [appointmentId, setAppointmentId] = useState<string | null>(defaultAppointmentId || null)

  useEffect(() => {
    if (defaultAppointmentId){ 
      setAppointmentId(defaultAppointmentId)
      document.getElementById('service-form')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [defaultAppointmentId])
  
  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) // Remove se já existe
        : [...prev, tag] // Adiciona se não existe
    )
  }

  async function handleSubmit(status: 'draft' | 'signed') {

    if (!content.trim()) {
      toast.warning("O conteúdo não pode estar vazio.")
      return
    }

    setIsSubmitting(true)
    
    const formData = new FormData()
    formData.append('customer_id', customerId)
    formData.append('content', content)
    formData.append('appointment_id', appointmentId || "")

    const result = await createServiceRecord(customerId, content, organizationId, selectedTags, appointmentId)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Registro salvo com sucesso!")
      setContent("")
      setAppointmentId(null)
      router.refresh()
    }
    
    setIsSubmitting(false)
  }

  return (
    <Card className="border-l-6 border-l-blue-500 mb-8">
      <CardHeader className="pt-2 bg-gray-50/50">
        <CardTitle className="text-base font-semibold text-gray-900">
          Novo Registro de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex items-center gap-2 mb-2">
          <TagIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Categorias:</span>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.label)
              return (
                <button
                key={tag.label}
                type="button"
                onClick={() => handleToggleTag(tag.label)}
                className={cn(
                  "inline-flex items-center px-2 py-1 rounded text-xs border",
                  isSelected ? cn(tag.color, "shadow-sm") : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground opacity-70 hover:opacity-100"
                )}>
                  {isSelected && <Check className="h-3 w-3 shrink-0" />}
                  {tag.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className={cn(
          "space-y-4 border rounded-lg p-4 bg-card transition-all duration-1000",
          appointmentId && "ring-2 ring-emerald-500 shadow-lg bg-emerald-50/10"
        )}>
          {appointmentId && (
            <div className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Vinculado à consulta finalizada
            </div>
          )}
        </div>
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