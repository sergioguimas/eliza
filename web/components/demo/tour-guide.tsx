'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"
import { buildDemoTour, type DemoTourStep } from "@/lib/demo/tour"
import { logDemoInteraction } from "@/app/actions/demo/log-demo-interaction"
import { TimelineSimulation } from "@/components/demo/timeline-simulation"
import { TourCta } from "@/components/demo/tour-cta"

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

  // Derruba só a apresentação visual do driver.js (popover + overlay), sem
  // tocar no listener do `awaitsEvent` nem no progresso salvo. O passo
  // continua logicamente ativo — só a parte que bloqueava cliques na página
  // some. Existe porque o overlay do driver.js captura todo clique fora do
  // elemento destacado; quando o próprio clique nesse elemento revela uma UI
  // nova maior que ele (um diálogo centralizado, o conteúdo de uma aba), o
  // overlay continua de pé bloqueando essa UI nova.
  const hidePopoverOnly = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
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

      // Passos sem `selector` (ex.: "retorno") não têm um alvo real na tela —
      // a UI que respondem é um modal que abre sozinho, não um elemento pra
      // destacar. `element` fica `null` de propósito, e o driver.js centraliza
      // o popover sozinho (seu próprio elemento-fantasma interno) quando
      // `highlight()` não recebe `element`.
      const element = step.selector ? await waitForElement(step.selector) : null

      if (cancelled) return

      // Some com o balão anterior mesmo quando o próximo alvo não aparece.
      // Sem isto, sair de uma rota para outra onde o passo não existe deixava o
      // balão da tela antiga preso, falando de algo que não está mais ali.
      if (step.selector && !element) {
        destroyActive()
        return
      }

      destroyActive()

      const instance = driver({
        allowClose: false,
        // Clique fora do elemento destacado não faz nada — nem fecha nem
        // avança. Sem isso, o comportamento padrão do driver.js destrói o
        // tour inteiro no primeiro clique acidental fora do balão. O botão
        // "×" nunca fica visível (não entra em `showButtons`), então não
        // existe hoje nenhuma saída deliberada pela UI — `onCloseClick` fica
        // órfã na prática, mantida só para o tipo do driver.js.
        overlayClickBehavior: () => {},
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "eliza-demo-tour",
        nextBtnText: "Entendi",
        doneBtnText: "Entendi",
        onNextClick: advance,
        onCloseClick: abandonStep,
      })

      // O CSS do driver.js desativa pointer-events na página inteira
      // enquanto o overlay está ativo (`.driver-active *{pointer-events:none}`),
      // com exceção só do elemento destacado e do próprio popover. Qualquer
      // UI que abra por portal — diálogo, dropdown, menu de contexto,
      // conteúdo de aba — nasce FORA do elemento destacado e fica travada
      // enquanto o overlay durar. Por isso todo passo derruba a
      // apresentação assim que o visitante clica no alvo, não só os que
      // esperam evento: o clique costuma ser exatamente o que abre a UI que
      // precisa ficar clicável. Sem elemento (passo autoRevealed), não há o
      // que escutar — o timer abaixo cuida disso.
      element?.addEventListener("click", hidePopoverOnly, { once: true })

      if (step.awaitsEvent) {
        const eventName = step.awaitsEvent
        const handler = () => advance()

        window.addEventListener(eventName, handler, { once: true })

        if (step.autoRevealed) {
          // A UI que resolve este passo (o modal automático de retorno)
          // não nasce de um clique no elemento destacado — já está a
          // caminho assim que o passo aparece, disparada pelo passo
          // anterior. Não há clique pra escutar aqui: dá um instante pro
          // visitante ler o balão, depois libera a página por conta própria.
          // 4s, não 1.5s — o texto tem duas frases, e 1.5s não dava tempo
          // de ler antes do balão sumir sozinho (relato do Sérgio).
          const timer = setTimeout(hidePopoverOnly, 4000)
          eventCleanupRef.current = () => {
            window.removeEventListener(eventName, handler)
            clearTimeout(timer)
          }
        } else {
          eventCleanupRef.current = () =>
            window.removeEventListener(eventName, handler)
        }
      }

      driverRef.current = instance
      activeStepRef.current = step.id

      // Passa o elemento já resolvido, não o seletor: deixar o driver refazer a
      // busca reintroduziria o problema do alvo escondido do outro layout.
      // Sem elemento, o driver.js centraliza o popover sozinho.
      instance.highlight({
        ...(element ? { element } : {}),
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
  }, [pathname, steps, storageKey, destroyActive, persist, hidePopoverOnly])

  useEffect(() => () => destroyActive(), [destroyActive])

  const onDone = () => customAdvanceRef.current?.()
  const onSkip = () => customAbandonRef.current?.()

  switch (customStep?.id) {
    case "timeline":
      return <TimelineSimulation onDone={onDone} onSkip={onSkip} />
    case "cta":
      return (
        <TourCta
          organizationId={organizationId}
          onDone={onDone}
          onSkip={onSkip}
        />
      )
    default:
      return null
  }
}
