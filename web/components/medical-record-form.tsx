'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2 } from "lucide-react"
import { saveMedicalNote } from "@/app/actions/save-medical-note"
import { toast } from "sonner"

export function MedicalRecordForm({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState("")

  async function handleSave() {
    if (!content.trim()) return
    
    setLoading(true)
    const formData = new FormData()
    formData.append('customer_id', customerId)
    formData.append('content', content)

    const result = await saveMedicalNote(formData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Evolução salva com sucesso!")
      setContent("") // Limpa o campo após salvar
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <Textarea 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Descreva a evolução clínica do paciente..." 
        className="min-h-[200px] bg-zinc-950 border-zinc-800 focus:ring-blue-500 text-zinc-100"
      />
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading || !content.trim()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Salvar Evolução
        </Button>
      </div>
    </div>
  )
}