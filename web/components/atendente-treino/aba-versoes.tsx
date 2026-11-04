"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ativarVersao, listarVersoes } from "@/app/actions/atendente-treino"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { RespostaAtivar } from "@/contracts/autoatendimento"
import { dataCurta, descreverMudanca, descreverOrigem, descreverPadrao, TEXTO_DO_ERRO } from "./descrever"
import { useDados } from "./usar-dados"

export function AbaVersoes({ aoVerAprendi }: { aoVerAprendi: () => void }) {
  const { dados: versoes, erro, recarregar } = useDados(listarVersoes)
  const [removidas, setRemovidas] = useState<RespostaAtivar["rejeitadas"]>([])

  async function usar(n: number) {
    const r = await ativarVersao(n)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    setRemovidas(r.dados.rejeitadas)
    await recarregar()
  }

  if (erro) return <p className="text-sm text-muted-foreground">{erro}</p>
  if (!versoes) return <Skeleton className="h-40 w-full" />

  if (!versoes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma versão ainda</CardTitle>
          <CardDescription>Cada treino que muda o jeito do atendente cria uma versão aqui.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {removidas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Removido junto com a versão</CardTitle>
            <CardDescription>O atendente não volta a aprender isto sozinho.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc space-y-1 pl-5">
              {removidas.map((r) => (
                <li key={r.id}>{descreverPadrao(r.campo, r.valor)}</li>
              ))}
            </ul>
            <Button variant="link" className="mt-1 h-auto p-0" onClick={aoVerAprendi}>
              Ver em O que aprendi
            </Button>
          </CardContent>
        </Card>
      )}

      {versoes.map((v) => (
        <Card key={v.versao}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                Versão {v.versao}
                {v.ativa && <Badge>Em uso</Badge>}
              </CardTitle>
              {!v.ativa && <UsarVersao versao={v.versao} aoConfirmar={() => usar(v.versao)} />}
            </div>
            <CardDescription>
              {dataCurta(v.criadaEm)} · {descreverOrigem(v)}
            </CardDescription>
          </CardHeader>
          {v.mudancas.length > 0 && (
            <CardContent className="text-sm">
              <ul className="list-disc space-y-1 pl-5">
                {v.mudancas.map((m) => (
                  <li key={m.campo} className="break-words">
                    {descreverMudanca(m)}
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}

function UsarVersao({ versao, aoConfirmar }: { versao: number; aoConfirmar: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Usar esta versão
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Voltar para a versão {versao}?</AlertDialogTitle>
          <AlertDialogDescription>
            O que o atendente aprendeu depois dela é removido e não volta sozinho nos próximos treinos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={aoConfirmar}>Usar esta versão</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
