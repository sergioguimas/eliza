'use client'

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, KeyRound, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createApiKey, revokeApiKey } from "@/app/actions/api-keys"

export type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

export type ApiLogRow = {
  id: string
  key_prefix: string
  method: string
  path: string
  status_code: number
  duration_ms: number | null
  ip: string | null
  created_at: string
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"

export function ApiKeysSettings({ keys, logs }: { keys: ApiKeyRow[]; logs: ApiLogRow[] }) {
  const [name, setName] = useState("")
  const [canWrite, setCanWrite] = useState(true)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    startTransition(async () => {
      const result = await createApiKey({ name, scopes: canWrite ? ["read", "write"] : ["read"] })

      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }

      if ("apiKey" in result && result.apiKey) {
        setNewKey(result.apiKey)
        setName("")
        toast.success("Chave criada.")
      }
    })
  }

  function handleRevoke(id: string) {
    if (!confirm("Revogar esta chave? Integrações que a usam deixarão de funcionar.")) return

    startTransition(async () => {
      const result = await revokeApiKey(id)

      if ("error" in result && result.error) toast.error(result.error)
      else toast.success("Chave revogada.")
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Chaves de API
          </CardTitle>
          <CardDescription>
            Use a chave no header <code>Authorization: Bearer &lt;chave&gt;</code> em <code>/api/v1</code>. Cada chave
            acessa apenas os dados desta organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {newKey && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
              <p className="text-sm font-medium">Copie agora: esta chave não será exibida novamente.</p>
              <div className="flex gap-2">
                <Input readOnly value={newKey} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(newKey)
                    toast.success("Chave copiada.")
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNewKey(null)}>
                  Ok
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="api-key-name">Nome da chave</Label>
              <Input
                id="api-key-name"
                value={name}
                maxLength={80}
                placeholder="Ex.: Agente de atendimento"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox id="api-key-write" checked={canWrite} onCheckedChange={(v) => setCanWrite(v === true)} />
              <Label htmlFor="api-key-write">Permitir escrita</Label>
            </div>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar chave
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Escopos</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma chave criada.
                  </TableCell>
                </TableRow>
              )}
              {keys.map((key) => {
                const expired = !!key.expires_at && new Date(key.expires_at) <= new Date()

                return (
                  <TableRow key={key.id}>
                    <TableCell>{key.name}</TableCell>
                    <TableCell className="font-mono text-xs">{key.key_prefix}…</TableCell>
                    <TableCell>{key.scopes.join(", ")}</TableCell>
                    <TableCell>{fmt(key.last_used_at)}</TableCell>
                    <TableCell>
                      {key.revoked_at ? (
                        <Badge variant="destructive">Revogada</Badge>
                      ) : expired ? (
                        <Badge variant="secondary">Expirada</Badge>
                      ) : (
                        <Badge>Ativa</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!key.revoked_at && (
                        <Button variant="ghost" size="icon" disabled={pending} onClick={() => handleRevoke(key.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso recente da API</CardTitle>
          <CardDescription>Últimas 50 requisições de todas as chaves desta organização.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Requisição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma requisição registrada.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{fmt(log.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{log.key_prefix}…</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.method} {log.path}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status_code >= 400 ? "destructive" : "secondary"}>{log.status_code}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{log.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
