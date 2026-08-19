'use client'

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, Check, Clock3, Loader2, Pause, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  createDemoTimeline,
  type DemoTimelineEvent,
} from "@/app/actions/demo/create-demo-timeline"

const TZ = "America/Sao_Paulo"

const REVEAL_INTERVAL_MS = 1400

const ICON_BY_TYPE: Record<DemoTimelineEvent["eventType"], typeof Bell> = {
  reminder_1h: Bell,
  client_confirmed: Check,
  appointment_time: Clock3,
}

function formatWhen(iso: string) {
  const date = new Date(iso)

  const day = date.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })

  const time = date.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${day} · ${time}`
}

type TimelineSimulationProps = {
  onDone: () => void
  onSkip: () => void
}

/**
 * Mostra, em poucos segundos, a sequência de avisos que a automação do Eliza
 * dispararia sozinha nos minutos antes de um compromisso real — sem esperar
 * o relógio de verdade chegar lá. "Fast-forward": os horários são reais (o
 * agendamento pode estar dias à frente), só a apresentação é comprimida.
 *
 * Nenhuma mensagem sai daqui de verdade — isso é o passo seguinte do tour,
 * com o chip dedicado. Este componente só narra o que a Fase 8 vai mostrar
 * acontecendo de fato.
 */
export function TimelineSimulation({ onDone, onSkip }: TimelineSimulationProps) {
  const [events, setEvents] = useState<DemoTimelineEvent[] | null>(null)
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    createDemoTimeline().then((result) => {
      if (cancelled) return

      if (!result.ok) {
        setError(result.error)
        return
      }

      setEvents(result.events)
      setAppointmentTime(result.appointmentTime)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!playing || !events) return
    if (revealed >= events.length) return

    timerRef.current = setInterval(() => {
      setRevealed((count) => {
        const next = count + 1

        if (next >= events.length && timerRef.current) {
          clearInterval(timerRef.current)
        }

        return next
      })
    }, REVEAL_INTERVAL_MS)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [playing, events, revealed])

  const allRevealed = events !== null && revealed >= events.length

  return (
    <Dialog open onOpenChange={(open) => !open && onSkip()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Enquanto isso, nos bastidores...</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Não deu para montar a simulação agora, mas a ideia é essa: o
              Eliza avisa o cliente automaticamente antes de cada compromisso.
            </p>
            <Button onClick={onDone} className="w-full">
              Continuar
            </Button>
          </div>
        )}

        {!error && !events && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!error && events && (
          <div className="space-y-4">
            {appointmentTime && (
              <p className="text-xs text-muted-foreground">
                Compromisso real: {formatWhen(appointmentTime)}. Os horários
                abaixo são de verdade — só a espera que a gente pula.
              </p>
            )}

            <ol className="relative space-y-4 border-l border-border pl-5">
              <AnimatePresence initial={false}>
                {events.slice(0, revealed).map((event) => {
                  const Icon = ICON_BY_TYPE[event.eventType]
                  const text = event.messageText ?? event.responseText ?? ""
                  const isReply = event.eventType === "client_confirmed"

                  return (
                    <motion.li
                      key={event.eventType}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative"
                    >
                      <span className="absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>

                      <p className="text-[11px] text-muted-foreground">
                        {formatWhen(event.simulatedTime)}
                      </p>

                      <p
                        className={
                          isReply
                            ? "mt-1 inline-block rounded-lg rounded-tl-sm bg-muted px-3 py-1.5 text-sm"
                            : "mt-1 inline-block rounded-lg rounded-tl-sm bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-400"
                        }
                      >
                        {text}
                      </p>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={allRevealed}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? (
                  <>
                    <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Continuar
                  </>
                )}
              </Button>

              {allRevealed ? (
                <Button size="sm" onClick={onDone}>
                  Entendi
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed((count) => count + 1)}
                >
                  Avançar
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
