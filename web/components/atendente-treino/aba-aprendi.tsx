"use client"

import { useState } from "react"
import { toast } from "sonner"
import { lerAprendido, rejeitarObservacao, restaurarObservacao, zerarPerfil } from "@/app/actions/atendente-treino"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { Observacao } from "@/contracts/autoatendimento"
import { descreverPadrao, descreverPerfil, TEXTO_DO_ERRO } from "./descrever"
import { useDados } from "./usar-dados"

export function AbaAprendi() {
  const { dados, erro, recarregar } = useDados(lerAprendido)

  async function mudar(acao: (id: string) => ReturnType<typeof rejeitarObservacao>, id: string) {
    const r = await acao(id)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    await recarregar()
  }

  if (erro) return <p className="text-sm text-muted-foreground">{erro}</p>
  if (!dados) return <Skeleton className="h-40 w-full" />

  const linhas = descreverPerfil(dados.perfil.perfil)
  const emUso = dados.observacoes.filter((o) => o.estado === "candidata" && o.elegivel)
  const confirmando = dados.observacoes.filter((o) => o.estado === "candidata" && !o.elegivel)
  const removidas = dados.observacoes.filter((o) => o.estado === "rejeitada")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Como o atendente escreve</CardTitle>
          {!linhas.length && <CardDescription>Ainda não aprendi seu jeito. Faça um treino para começar.</CardDescription>}
        </CardHeader>
        {linhas.length > 0 && (
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              {linhas.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {dados.perfil.secaoPrompt && (
              <details>
                <summary className="cursor-pointer text-muted-foreground">Como isto entra no atendente</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
                  {dados.perfil.secaoPrompt}
                </pre>
              </details>
            )}
          </CardContent>
        )}
      </Card>

      <Lista titulo="Em uso" itens={emUso} rotulo="Em uso" acao={(o) => <Remover o={o} aoConfirmar={() => mudar(rejeitarObservacao, o.id)} />} />
      <Lista titulo="Confirmando" itens={confirmando} rotulo="Confirmando" acao={(o) => <Remover o={o} aoConfirmar={() => mudar(rejeitarObservacao, o.id)} />} />
      <Lista
        titulo="Removidas"
        itens={removidas}
        rotulo="Removida"
        acao={(o) => (
          <Button variant="outline" size="sm" onClick={() => mudar(restaurarObservacao, o.id)}>
            Voltar a usar
          </Button>
        )}
      />

      {dados.observacoes.length > 0 && <ComecarDoZero aoZerar={recarregar} />}
    </div>
  )
}

function Lista({
  titulo,
  itens,
  rotulo,
  acao,
}: {
  titulo: string
  itens: Observacao[]
  rotulo: string
  acao: (o: Observacao) => React.ReactNode
}) {
  if (!itens.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {itens.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 text-sm">
                <p className="break-words">{descreverPadrao(o.campo, o.valor)}</p>
                {o.citacao && o.campo !== "exemplos" && <p className="break-words text-xs text-muted-foreground">“{o.citacao}”</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{rotulo}</Badge>
                {acao(o)}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Remover({ o, aoConfirmar }: { o: Observacao; aoConfirmar: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Remover
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover “{descreverPadrao(o.campo, o.valor)}”?</AlertDialogTitle>
          <AlertDialogDescription>O atendente para de usar isto e não volta a aprender sozinho.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={aoConfirmar}>Remover</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ComecarDoZero({ aoZerar }: { aoZerar: () => Promise<void> }) {
  const [confirmacao, setConfirmacao] = useState("")

  async function zerar() {
    const r = await zerarPerfil()

    setConfirmacao("")
    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    await aoZerar()
  }

  return (
    <AlertDialog onOpenChange={() => setConfirmacao("")}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Começar do zero</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Começar do zero?</AlertDialogTitle>
          <AlertDialogDescription>
            O atendente esquece tudo o que aprendeu, e as notas pendentes são descartadas. Digite ZERAR para confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} aria-label="Digite ZERAR para confirmar" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={confirmacao !== "ZERAR"} onClick={zerar}>
            Começar do zero
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
