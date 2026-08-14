'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"
import { buildDemoTour, type DemoTourStep } from "@/lib/demo/tour"
import { logDemoInteraction } from "@/app/actions/demo/log-demo-interaction"
import { TimelineSimulation } from "@/components/demo/timeline-simulation"

type TourGuideProps = {
  organizationId: string
  niche: string
}

type Progress = { index: number; done: boolean }

const STORAGE_PREFIX = "eliza:demo-tour:"

function readProgress(key: string): Progress {
  if (typeof window === "undefined") return { index: 0, done: false }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { index: 0, done: false }

    const parsed = JSON.parse(raw)

    return {
      index: typeof parsed.index === "number" ? parsed.index : 0,
      done: parsed.done === true,
    }
  } catch {
    return { index: 0, done: false }
  }
}

function writeProgress(key: string, progress: Progress) {
  try {
    window.localStorage.setItem(key, JSON.stringify(progress))
  } catch {
    // Navegador com storage bloqueado: o tour ainda funciona, só não retoma
    // de onde parou depois de um refresh.
  }
}

/**
 * Espera o alvo existir antes de destacar.
 *
 * Vários passos apontam para coisas que aparecem depois da hidratação ou de uma
 * navegação — destacar um seletor que ainda não montou faz o balão nascer no
 * canto da tela, apontando para nada.
 */
function findVisible(selector: string) {
  // A navegação existe duas vezes no DOM, uma para desktop e outra para
  // mobile, e só uma está visível. `querySelector` pegaria a primeira em ordem
  // de documento, que pode ser justamente a escondida — e o balão apontaria
  // para um elemento de tamanho zero.
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))

  return (
    candidates.find((candidate) => candidate.offsetParent !== null) ??
    candidates[0] ??
    null
  )
}

function waitForElement(selector: string, timeoutMs = 4000) {
  return new Promise<HTMLElement | null>((resolve) => {
    const existing = findVisible(selector)
    if (existing) return resolve(existing)

    const observer = new MutationObserver(() => {
      const found = findVisible(selector)

      if (found) {
        observer.disconnect()
        clearTimeout(timer)
        resolve(found)
      }
    })

    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeoutMs)

    observer.observe(document.body, { childList: true, subtree: true })
  })
}

/**
 * Conduz o tour da demonstração.
 *
 * O tour não é um roteiro próprio por cima do produto: ele acompanha o caminho
 * que o Eliza já faz sozinho. Cada passo declara em que rota vive, e o
 * componente reancorna a cada navegação — então sair do trilho, atualizar a
 * página ou abrir outra aba não quebra nada, só faz o balão aparecer quando o
 * visitante volta para onde o passo mora.
 */
export function TourGuide({ organizationId, niche }: TourGuideProps) {
  const pathname = usePathname()
  const steps = useMemo(() => buildDemoTour(niche), [niche])
  const storageKey = `${STORAGE_PREFIX}${organizationId}`

  const driverRef = useRef<Driver | null>(null)
  const activeStepRef = useRef<string | null>(null)
  // Listener de `awaitsEvent` do passo ativo, se houver. Fica num ref, não
  // numa variável local de `show()`, porque `destroyActive` é chamado de
  // vários lugares — início de cada `show()`, unmount — e precisa conseguir
  // desarmar um listener que nunca disparou. Sem isso, sair da rota antes de
  // criar o agendamento deixava o listener pendurado no `window`; se disparasse
  // depois, em outro passo, `advance()` usaria o `index` antigo e corrompia o
  // progresso já salvo.
  const eventCleanupRef = useRef<(() => void) | null>(null)

  // Passo "custom" (hoje só a timeline) não usa driver.js — é um componente
  // React de verdade, renderizado no JSX deste componente. `advance`/`abandon`
  // ficam em refs pelo mesmo motivo do listener acima: são recriados a cada
  // chamada de `show()`, mas o componente que os aciona vive fora daquele
  // closure, então precisa sempre pegar a versão mais recente.
  const [customStep, setCustomStep] = useState<DemoTourStep | null>(null)
  const customAdvanceRef = useRef<(() => void) | null>(null)
  const customAbandonRef = useRef<(() => void) | null>(null)

  const destroyActive = useCallback(() => {
    eventCleanupRef.current?.()
    eventCleanupRef.current = null
    driverRef.current?.destroy()
    driverRef.current = null
    activeStepRef.current = null
    customAdvanceRef.current = null
    customAbandonRef.current = null
    setCustomStep(null)
  }, [])

  const persist = useCallback(
    (progress: Progress) => writeProgress(storageKey, progress),
    [storageKey]
  )

  useEffect(() => {
    let cancelled = false

    async function show() {
      const progress = readProgress(storageKey)

      if (progress.done) return

      // Procura, a partir de onde paramos, o primeiro passo que pertence à rota
      // atual. Isso é o que faz um passo de navegação se resolver sozinho: ao
      // chegar na rota seguinte, o passo anterior fica para trás.
      const index = steps.findIndex(
        (step, position) => position >= progress.index && step.match.test(pathname)
      )

      if (index === -1) {
        destroyActive()
        return
      }

      const step = steps[index]

      if (activeStepRef.current === step.id) return

      if (index > progress.index) {
        persist({ index, done: false })
      }

      // Compartilhado pelos dois tipos de passo — popover (clique em
      // "Entendi" ou evento) e custom (o próprio componente chama). Duplicar
      // esta lógica em três lugares é como progresso e telemetria divergem.
      function advance() {
        const next = index + 1
        const finished = next >= steps.length

        persist({ index: next, done: finished })
        void logDemoInteraction({
          action: finished ? "tour_completed" : "step_completed",
          stepNumber: index + 1,
          metadata: { step: step.id },
        })

        destroyActive()

        // Reavalia na mesma rota: o próximo passo pode morar aqui mesmo.
        if (!finished) void show()
      }

      function abandonStep() {
        persist({ index, done: true })
        void logDemoInteraction({
          action: "tour_abandoned",
          stepNumber: index + 1,
          metadata: { step: step.id },
        })

        destroyActive()
      }

      if (step.kind === "custom") {
        destroyActive()

        activeStepRef.current = step.id
        customAdvanceRef.current = advance
        customAbandonRef.current = abandonStep
        setCustomStep(step)

        return
      }

      const element = await waitForElement(step.selector!)

      if (cancelled) return

      // Some com o balão anterior mesmo quando o próximo alvo não aparece.
      // Sem isto, sair de uma rota para outra onde o passo não existe deixava o
      // balão da tela antiga preso, falando de algo que não está mais ali.
      if (!element) {
        destroyActive()
        return
      }

      destroyActive()

      const instance = driver({
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "eliza-demo-tour",
        nextBtnText: "Entendi",
        doneBtnText: "Entendi",
        onNextClick: advance,
        onCloseClick: abandonStep,
      })

      if (step.awaitsEvent) {
        const eventName = step.awaitsEvent
        const handler = () => advance()

        window.addEventListener(eventName, handler, { once: true })
        eventCleanupRef.current = () =>
          window.removeEventListener(eventName, handler)
      }

      driverRef.current = instance
      activeStepRef.current = step.id

      // Passa o elemento já resolvido, não o seletor: deixar o driver refazer a
      // busca reintroduziria o problema do alvo escondido do outro layout.
      instance.highlight({
        element,
        popover: {
          title: step.title,
          description: step.description,
          // Precisa ficar no popover, não na configuração do driver: em modo
          // `highlight` a config global não governa os botões, e o rodapé
          // voltava a mostrar um "Previous" em inglês.
          //
          // Sem "previous" de propósito: o tour acompanha o estado real do
          // sistema, e voltar um passo não desfaz o que já foi gravado. Botão
          // que promete voltar e não volta é pior do que botão nenhum.
          //
          // `awaitsEvent` também esconde o botão: mostrar "Entendi" ali
          // deixaria o visitante pular o passo sem ter criado nada, e o tour
          // seguiria como se tivesse.
          showButtons:
            step.awaitsNavigation || step.awaitsEvent ? [] : ["next"],
        },
      })
    }

    void show()

    return () => {
      cancelled = true
    }
  }, [pathname, steps, storageKey, destroyActive, persist])

  useEffect(() => () => destroyActive(), [destroyActive])

  // Só existe um passo "custom" hoje (a timeline). Se um segundo aparecer, é
  // aqui que vira um mapa de id → componente em vez de um if solto.
  if (customStep?.id === "timeline") {
    return (
      <TimelineSimulation
        onDone={() => customAdvanceRef.current?.()}
        onSkip={() => customAbandonRef.current?.()}
      />
    )
  }

  return null
}
