"use client"

import { useCallback, useEffect, useState } from "react"
import type { Resultado } from "@/lib/autoatendimento/treino-regras"
import { TEXTO_DO_ERRO } from "./descrever"

/**
 * Carrega os dados da aba ao montar e devolve como recarregar depois de uma ação.
 * `ler` precisa ser estável (função de módulo). A aba é desmontada ao trocar de
 * aba: resposta que chega depois disso é ignorada.
 */
export function useDados<T>(ler: () => Promise<Resultado<T>>) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const aplicar = useCallback((r: Resultado<T>) => {
    if (r.ok) {
      setErro(null)
      setDados(r.dados)
    } else {
      setErro(TEXTO_DO_ERRO[r.erro])
    }
  }, [])

  useEffect(() => {
    let viva = true

    void ler().then((r) => {
      if (viva) aplicar(r)
    })

    return () => {
      viva = false
    }
  }, [ler, aplicar])

  const recarregar = useCallback(async () => aplicar(await ler()), [ler, aplicar])

  return { dados, erro, recarregar }
}
