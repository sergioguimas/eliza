'use client'

import { useRouter, useSearchParams } from "next/navigation"
import { ReturnPromptDialog } from "@/components/appointments/return-prompt-dialog"

interface ReturnModalWrapperProps {
  customerName: string
  customerId: string
}

export function ReturnModalWrapper({
  customerName,
  customerId,
}: ReturnModalWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("show_return_modal") === "true"

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("show_return_modal")

      const query = params.toString()
      router.push(query ? `?${query}` : "?", { scroll: false })
      window.dispatchEvent(new CustomEvent("eliza:return-resolved"))
    }
  }

  const handleConfirm = (days: number | null) => {
    const params = new URLSearchParams()
    params.set("customer_id", customerId)
    params.set("new", "true")

    if (days !== null) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      params.set("date", date.toISOString().split("T")[0])
    }

    // Sem disparo de `eliza:return-resolved` aqui, de propósito: os dois
    // caminhos deste handler navegam pra /agendamentos, e disparar o evento
    // antes do `router.push` corria contra a própria navegação — o tour
    // chegava a piscar o passo "pago" ainda na ficha do cliente, um instante
    // antes da rota trocar de verdade. O passo "retorno-agendamento" (em
    // tour.ts) é quem resolve este trecho agora, ancorado na rota nova.
    router.push(`/agendamentos?${params.toString()}`)
  }

  return (
    <ReturnPromptDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      customerName={customerName}
    />
  )
}