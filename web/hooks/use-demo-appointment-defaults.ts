'use client'

import { useEffect, useState } from "react"
import {
  getDemoAppointmentDefaults,
  type DemoAppointmentDefaults,
} from "@/app/actions/demo/get-appointment-defaults"

// Uma tentativa inicial + uma repetição. Falha isolada (rede, timeout,
// service role fora do ar por um instante) não pode deixar o pré-preenchido
// permanentemente ausente pro resto da sessão do visitante.
const MAX_ATTEMPTS = 2

/**
 * Busca os defaults de agendamento da demonstração assim que o componente
 * monta — bem antes de qualquer clique — para que o formulário já abra
 * preenchido na primeira tentativa do visitante.
 *
 * Não é chamado fora do modo demo: `isDemo` vem de `user_metadata`, então o
 * hook nem dispara a ida ao servidor para um tenant real.
 */
export function useDemoAppointmentDefaults(
  isDemo: boolean,
  organizationId: string
) {
  const [defaults, setDefaults] = useState<DemoAppointmentDefaults>(null)
  const [loading, setLoading] = useState(isDemo)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isDemo || attempt >= MAX_ATTEMPTS) return

    // Sem uma flag "já disparei" permanente de propósito: era ela que travava
    // o pré-preenchido pro resto da sessão quando a única tentativa falhava
    // (ou era descartada pelo double-invoke do StrictMode em dev). O efeito só
    // roda de novo quando `attempt` muda — e `attempt` só muda quando a
    // tentativa anterior falhou/voltou vazia — então não há disparo em loop,
    // só a repetição deliberada até `MAX_ATTEMPTS`.
    let ignore = false

    const retryOrGiveUp = () => {
      if (ignore) return
      if (attempt + 1 < MAX_ATTEMPTS) {
        setAttempt((a) => a + 1)
      } else {
        setLoading(false)
      }
    }

    getDemoAppointmentDefaults(organizationId)
      .then((result) => {
        if (ignore) return
        if (result) {
          setDefaults(result)
          setLoading(false)
        } else {
          retryOrGiveUp()
        }
      })
      .catch(() => {
        retryOrGiveUp()
      })

    return () => {
      ignore = true
    }
  }, [isDemo, organizationId, attempt])

  return { defaults, loading }
}
