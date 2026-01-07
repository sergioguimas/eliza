'use client'

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { updateMessageTemplate } from "@/app/actions/update-template"
import { Save, RefreshCcw } from "lucide-react"

interface Template {
  id: string
  type: string
  name: string
  content: string
}

export function MessagesSettings({ templates }: { templates: Template[] }) {
  // Pega o template de cancelamento (ou null se não existir)
  const cancelTemplate = templates.find(t => t.type === 'cancellation_response')
  
  const [content, setContent] = useState(cancelTemplate?.content || '')
  const [isPending, startTransition] = useTransition()

  // Se não tiver template, nem mostra o componente (evita erro)
  if (!cancelTemplate) return null

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateMessageTemplate(cancelTemplate.id, content)
        toast.success("Mensagem atualizada com sucesso!")
      } catch (error) {
        toast.error("Erro ao salvar mensagem.")
      }
    })
  }

  const handleReset = () => {
    // Volta para o valor original que veio do banco
    setContent(cancelTemplate.content)
    toast.info("Alterações descartadas.")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resposta de Cancelamento</CardTitle>
          <CardDescription>
            Esta é a mensagem enviada automaticamente quando o paciente responde &quot;Não&quot; ou &quot;Cancelar&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          <div className="space-y-2">
            <Label>Variáveis Disponíveis</Label>
            <div className="flex gap-2">
              <Badge variant="secondary" className="font-mono text-xs cursor-help" title="Lista os horários livres">
                {`{{horarios_livres}}`}
              </Badge>
              {/* Futuramente podemos adicionar {{paciente}}, {{medico}}, etc */}
            </div>
            <p className="text-xs text-muted-foreground">
              O robô substituirá essas etiquetas pelos dados reais no momento do envio.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Texto da Mensagem</Label>
            <Textarea 
              id="message" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] font-sans"
              placeholder="Digite a mensagem..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isPending}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Restaurar
            </Button>
            <Button onClick={handleSave} size="sm" disabled={isPending}>
              <Save className="mr-2 h-4 w-4" />
              {isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}