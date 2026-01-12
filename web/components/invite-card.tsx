'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Check, Copy, Link as LinkIcon, Loader2 } from "lucide-react"
import { generateInviteLink } from "@/app/actions/generate-invite"
import { toast } from "sonner"

export function InviteCard() {
  const [inviteUrl, setInviteUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    const result = await generateInviteLink()
    
    if (result.error) {
      toast.error(result.error)
    } else if (result.code) {
      // Monta o link completo
      const url = `${window.location.origin}/convite/${result.code}`
      setInviteUrl(url)
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
          Gere um link temporário para adicionar sua secretária ou sócio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!inviteUrl ? (
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Gerar Link de Convite"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input value={inviteUrl} readOnly className="bg-background" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          * Este link expira em 48 horas.
        </p>
      </CardContent>
    </Card>
  )
}