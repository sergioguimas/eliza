'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Check, Copy, Link as LinkIcon, Loader2 } from "lucide-react"
import { generateInviteLink } from "@/app/actions/generate-invite"
import { toast } from "sonner"

export function InviteCard() {
  const [inviteUrl, setInviteUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Estado para controlar o cargo (padrão: staff/secretária)
  const [role, setRole] = useState<'staff' | 'professional'>('staff')

  async function handleGenerate() {
    setLoading(true)
    // Passamos o cargo escolhido para a server action
    const result = await generateInviteLink(role)
    
    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      setInviteUrl(result.url)
      toast.success("Link gerado! Copie e envie no WhatsApp.")
    }
    setLoading(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Link copiado!")
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-primary" />
          Convidar Membro
        </CardTitle>
        <CardDescription>
          Gere um link temporário para adicionar profissionais ou secretárias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* SELETOR DE CARGO (Só aparece se ainda não gerou o link) */}
        {!inviteUrl && (
          <div className="space-y-2">
            <Label>Função do novo membro</Label>
            <Select 
              value={role} 
              onValueChange={(val: 'staff' | 'professional') => setRole(val)}
              disabled={loading}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Secretária / Recepção (Sem Agenda)</SelectItem>
                <SelectItem value="professional">Profissional de Saúde (Com Agenda)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ÁREA DO LINK / BOTÃO */}
        {!inviteUrl ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Gerar Link de Convite"}
          </Button>
        ) : (
          <div className="flex gap-2 animate-in fade-in">
            <Input value={inviteUrl} readOnly className="bg-background" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
        
        {inviteUrl && (
            <p className="text-xs text-muted-foreground text-center">
                Este link expira em 48 horas.
                <br/>
                <button 
                    onClick={() => setInviteUrl("")} 
                    className="text-primary underline mt-1 hover:text-primary/80"
                >
                    Gerar outro
                </button>
            </p>
        )}
      </CardContent>
    </Card>
  )
}