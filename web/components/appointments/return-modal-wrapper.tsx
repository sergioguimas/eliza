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