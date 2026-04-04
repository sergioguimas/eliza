'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, Copy, Link as LinkIcon, Loader2, RefreshCw } from "lucide-react"
import { generateInvite } from "@/app/actions/generate-invite"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

interface InviteCardProps {
  organizationId: string
}

export function InviteCard({ organizationId }: InviteCardProps) {
  const [inviteUrl, setInviteUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [role, setRole] = useState<'staff' | 'professional'>('staff')

  const { dict } = useKeckleon()
  const actions = dict.actions || {}
  const messages = dict.messages || {}
  const fields = dict.fields || {}
  const sections = dict.sections || {}
  const entities = dict.entities || {}

  const profissional = entities.profissional || "Profissional"

  async function handleGenerate() {
    setLoading(true)

    const result = await generateInvite(organizationId, role)

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      setInviteUrl(result.url)
      toast.success(
        messages.invite_generated_success || "Link de convite gerado com sucesso!"
      )
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success(messages.copied_success || "Copiado para a área de transferência")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-dashed border-2 shadow-sm bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-primary" />
          {sections.quick_invite || "Convite rápido"}
        </CardTitle>

        <CardDescription>
          {messages.invite_description ||
            "Gere um link para adicionar membros à equipe."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pb-2">
        {!inviteUrl && (
          <div className="space-y-2">
            <Label
              htmlFor="role-select"
              className="text-xs font-semibold text-muted-foreground uppercase"
            >
              {fields.user_permission || "Permissão do usuário"}
            </Label>

            <Select
              value={role}
              onValueChange={(val: 'staff' | 'professional') => setRole(val)}
              disabled={loading}
            >
              <SelectTrigger id="role-select" className="bg-background">
                <SelectValue
                  placeholder={messages.select_role || "Selecione a função"}
                />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="staff">
                  <span className="font-medium">
                    {messages.role_staff_title || "Staff / Recepção"}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {messages.role_staff_description ||
                      "Apenas vê agenda e cadastra clientes"}
                  </p>
                </SelectItem>

                <SelectItem value="professional">
                  <span className="font-medium">
                    {messages.role_professional_title ||
                      `${profissional} / Parceiro`}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {messages.role_professional_description ||
                      "Tem agenda própria e permissões operacionais"}
                  </p>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {inviteUrl ? (
          <div className="animate-in fade-in space-y-3">
            <div className="flex gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="bg-background font-mono text-sm"
              />

              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0"
                title={actions.copy || "Copiar"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => setInviteUrl("")}
                className="text-xs text-muted-foreground h-auto p-0"
              >
                {actions.generate_another_link || "Gerar outro link"}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {loading
              ? messages.generating || "Gerando..."
              : actions.generate_link || "Gerar link"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}