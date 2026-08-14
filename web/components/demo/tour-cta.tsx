'use client'

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDemoRecap } from "@/app/actions/demo/get-demo-recap"
import { submitDemoLead } from "@/app/actions/demo/submit-demo-lead"
import { resetDemo } from "@/app/actions/demo/reset-demo"

const STORAGE_PREFIX = "eliza:demo-tour:"

const RECAP_LABELS: Record<string, string> = {
  "novo-agendamento": "Criou um agendamento",
  concluir: "Marcou um atendimento como concluído",
  retorno: "Viu como funciona agendar o retorno",
  prontuario: "Registrou o atendimento",
  timeline: "Acompanhou os avisos automáticos",
}

// Ordem de leitura do checklist — não é a ordem em que os passos completam
// (a "steps" set não guarda isso), mas a ordem narrativa do tour.
const RECAP_ORDER = ["novo-agendamento", "concluir", "retorno", "prontuario", "timeline"]

type TourCtaProps = {
  organizationId: string
  onDone: () => void
  onSkip: () => void
}

type SubmitState = "idle" | "submitting" | "sent" | "error"
type ResetState = "idle" | "resetting" | "error"

/**
 * Último passo do tour: resumo do que o visitante fez, um jeito de deixar
 * contato, e a opção de recomeçar do zero. Não é um passo "popover" — é o
 * fechamento da demonstração, então ganha a tela inteira do modal.
 *
 * Terminar aqui, com ou sem deixar contato, conta como tour concluído — só o
 * fechamento implícito (X, Esc, clique fora) conta como abandono. Chegar até
 * este passo já significa que o visitante viu tudo; declinar o contato não é
 * a mesma coisa que sair no meio do caminho.
 */
export function TourCta({ organizationId, onDone, onSkip }: TourCtaProps) {
  const [completedSteps, setCompletedSteps] = useState<string[] | null>(null)
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resetState, setResetState] = useState<ResetState>("idle")

  useEffect(() => {
    let cancelled = false

    getDemoRecap().then((result) => {
      if (cancelled) return
      setCompletedSteps(result.ok ? result.completedSteps : [])
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitState("submitting")
    setSubmitError(null)

    const result = await submitDemoLead({ name, contact })

    if (!result.ok) {
      setSubmitState("error")
      setSubmitError(result.error ?? "Não foi possível enviar.")
      return
    }

    setSubmitState("sent")
    onDone()
  }

  async function handleRestart() {
    setResetState("resetting")

    const result = await resetDemo()

    if (!result.ok) {
      setResetState("error")
      return
    }

    // `onDone` primeiro: ele persiste `{done:true}` na MESMA chave que
    // limpamos a seguir. Chamar na ordem contrária faz o remove não valer de
    // nada — o advance() reescreve a chave por cima logo depois. Descoberto
    // testando: o reset funcionava, mas o tour nunca reaparecia.
    onDone()

    // O tour precisa recomeçar do passo 1, não continuar marcado como
    // concluído — sem isto, a reseed traria dados novos mas o `TourGuide`
    // continuaria achando que já tinha terminado.
    try {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${organizationId}`)
    } catch {
      // Storage bloqueado: o reset dos dados já aconteceu, só não some com o
      // "tour concluído" salvo — o visitante vê o dashboard, sem o tour.
    }

    // Navegação dura: a reseed troca os ids de clientes/agendamentos, e a
    // rota atual (/clientes/[id]) aponta para um registro que não existe
    // mais. O dashboard é o único destino estável depois de um reset.
    window.location.assign("/dashboard")
  }

  const recapItems = RECAP_ORDER.filter((id) => completedSteps?.includes(id))

  return (
    <Dialog open onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Gostou do que viu?</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {completedSteps === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : recapItems.length > 0 ? (
            <ul className="space-y-1.5">
              {recapItems.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  {RECAP_LABELS[id]}
                </li>
              ))}
            </ul>
          ) : null}

          {submitState === "sent" ? (
            <p className="text-sm text-muted-foreground">
              Prontinho! Anotamos seu contato — a gente fala com você em
              breve.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Deixe seu contato e a gente conversa sobre como isso fica
                pronto pro seu negócio.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="demo-lead-name">Nome</Label>
                <Input
                  id="demo-lead-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={submitState === "submitting"}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-lead-contact">E-mail ou WhatsApp</Label>
                <Input
                  id="demo-lead-contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  disabled={submitState === "submitting"}
                  required
                />
              </div>

              {submitError && (
                <p role="alert" className="text-xs text-destructive">
                  {submitError}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDone}
                  disabled={submitState === "submitting"}
                >
                  Só terminar
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={submitState === "submitting"}
                >
                  {submitState === "submitting" && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Quero conversar
                </Button>
              </div>
            </form>
          )}

          <div className="border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRestart}
              disabled={resetState === "resetting"}
            >
              {resetState === "resetting" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Recomeçar a demonstração
            </Button>

            {resetState === "error" && (
              <p role="alert" className="mt-1.5 text-xs text-destructive">
                Não foi possível recomeçar agora. Tente de novo.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
