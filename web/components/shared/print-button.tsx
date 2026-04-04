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
    <Button 
      onClick={() => window.print()} 
      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg gap-2"
    >
      <Printer className="h-4 w-4" />
      {actions.print || `Imprimir ${documento}`}
    </Button>
  )
}