'use client'
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <Button 
      onClick={() => window.print()} 
      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg gap-2"
    >
      <Printer className="h-4 w-4" /> Imprimir Documento
    </Button>
  )
}