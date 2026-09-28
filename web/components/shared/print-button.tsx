'use client'

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

export function PrintButton() {
  const { dict } = useKeckleon()
  const actions = dict.actions || {}
  const entities = dict.entities || {}

  const documento = entities.documento || "documento"

  return (
    <Button onClick={() => window.print()} className="gap-2 shadow-md">
      <Printer className="h-4 w-4" />
      {actions.print || `Imprimir ${documento}`}
    </Button>
  )
}