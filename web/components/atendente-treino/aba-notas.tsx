"use client"

import { useState } from "react"
import { toast } from "sonner"
import { aplicarNota, descartarNota, listarNotas } from "@/app/actions/atendente-treino"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Nota } from "@/contracts/autoatendimento"
import { TEXTO_DO_ERRO } from "./descrever"
import { useDados } from "./usar-dados"

const ESTADO: Record<Nota["estado"], string> = { pendente: "Pendente", aplicada: "Adicionada", descartada: "Descartada" }

export function AbaNotas() {
  const { dados: notas, erro, recarregar } = useDados(listarNotas)
  const [instrucoes, setInstrucoes] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  async function aplicar(id: string) {
    setOcupada(id)
    const r = await aplicarNota(id)
    setOcupada(null)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    setInstrucoes(r.dados.instrucoes)
    if (r.dados.aviso) toast.warning("Adicionei às instruções, mas a nota continua na lista. Tente de novo: não vai duplicar.")
    await recarregar()
  }

  async function descartar(id: string) {
    setOcupada(id)
    const r = await descartarNota(id)
    setOcupada(null)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    await recarregar()
  }

  if (erro) return <p className="text-sm text-muted-foreground">{erro}</p>
  if (!notas) return <Skeleton className="h-40 w-full" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fatos do treino</CardTitle>
          <CardDescription className="max-w-prose">
            Isto é informação do seu negócio, não jeito de falar. O atendente só usa depois que você adicionar. Confira se
            está certo.
          </CardDescription>
        </CardHeader>
        {!notas.length && (
          <CardContent className="text-sm text-muted-foreground">Nenhum fato anotado até agora.</CardContent>
        )}
      </Card>

      {instrucoes !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instruções do atendente agora</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">{instrucoes}</pre>
          </CardContent>
        </Card>
      )}

      {notas.map((n) => (
        <Card key={n.id}>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words">{n.texto}</p>
              <Badge variant={n.estado === "pendente" ? "default" : "secondary"}>{ESTADO[n.estado]}</Badge>
            </div>
            {n.citacao && <p className="break-words text-xs text-muted-foreground">Você disse: “{n.citacao}”</p>}
            {n.estado === "pendente" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={ocupada !== null} onClick={() => aplicar(n.id)}>
                  Adicionar às instruções do atendente
                </Button>
                <Button size="sm" variant="outline" disabled={ocupada !== null} onClick={() => descartar(n.id)}>
                  Descartar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
