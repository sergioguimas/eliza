'use client'

import { useMemo, useState } from "react"
import { Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSetupNicheOptions } from "@/lib/niche-config"
import { DEMO_NICHES } from "@/lib/demo/config"

export function DemoNichePicker() {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // O seletor mostra só os segmentos oferecidos na demonstração, que são um
  // subconjunto do que existe no produto — `certificado` fica de fora.
  const options = useMemo(
    () =>
      getSetupNicheOptions().filter((option) =>
        DEMO_NICHES.includes(option.id as (typeof DEMO_NICHES)[number])
      ),
    []
  )

  async function start(niche: string) {
    if (pending) return

    setPending(niche)
    setError(null)

    try {
      const response = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.redirectTo) {
        setError(payload?.error ?? "Não foi possível iniciar a demonstração.")
        setPending(null)
        return
      }

      // Navegação dura de propósito: o endpoint acabou de gravar o cookie de
      // sessão, e o layout do app é renderizado no servidor. Um push de client
      // poderia reaproveitar cache anterior à sessão e cair no /setup.
      window.location.assign(payload.redirectTo)
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente de novo.")
      setPending(null)
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="group"
        aria-label="Escolha o segmento da demonstração"
      >
        {options.map((option) => {
          const Icon = option.icon
          const isPending = pending === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => start(option.id)}
              disabled={pending !== null}
              aria-busy={isPending}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "disabled:cursor-not-allowed",
                isPending
                  ? cn("ring-2", option.selected)
                  : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md",
                pending !== null && !isPending && "opacity-50"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200",
                  option.soft,
                  isPending && "opacity-100",
                  pending === null && "group-hover:opacity-60"
                )}
              />

              <div className="relative flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-2xl border bg-white shadow-sm",
                      isPending ? "border-white/60" : "border-zinc-200",
                      option.color
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  ) : (
                    <ArrowRight className="h-5 w-5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-950">
                    {option.label}
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {isPending ? "Preparando seu ambiente..." : option.description}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  )
}
