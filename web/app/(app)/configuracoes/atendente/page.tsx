import { notFound } from "next/navigation"
import { PainelDeTreino } from "@/components/atendente-treino/painel"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { acessoTreino } from "@/lib/autoatendimento/treino-acesso"

export default async function TreinoDoAtendentePage() {
  const acesso = await acessoTreino()

  if (acesso.estado === "negado") notFound()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Treinar atendente</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ensine o atendente a escrever do seu jeito.</p>
      </header>

      {acesso.estado === "sem_env" ? (
        <Card>
          <CardHeader>
            <CardTitle>Treino indisponível</CardTitle>
            <CardDescription>O treino ainda não está disponível neste servidor.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <PainelDeTreino />
      )}
    </div>
  )
}
