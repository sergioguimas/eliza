'use client'

import { useKeckleon } from "@/providers/keckleon-provider"

export function ProcedureRanking({ data }: { data: Record<string, number> }) {
  const { dict } = useKeckleon()
  const messages = dict.messages || {}

  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a)
  const maxVal = sorted[0]?.[1] || 1

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {messages.no_data || "Nenhum dado registrado."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sorted.map(([name, value]) => (
        <div key={name} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{name}</span>
            <span className="text-muted-foreground">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(value)}
            </span>
          </div>

          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(value / maxVal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}