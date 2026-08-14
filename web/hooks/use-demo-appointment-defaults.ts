'use client'

import { useEffect, useRef, useState } from "react"
import {
  getDemoAppointmentDefaults,
  type DemoAppointmentDefaults,
} from "@/app/actions/demo/get-appointment-defaults"

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
  const requested = useRef(false)

  useEffect(() => {
    if (!isDemo || requested.current) return
    requested.current = true

    let cancelled = false

    getDemoAppointmentDefaults(organizationId)
      .then((result) => {
        if (!cancelled) setDefaults(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isDemo, organizationId])

  return { defaults, loading }
}
