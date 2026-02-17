'use client'

import { ReturnPromptDialog } from "./return-prompt-dialog"
import { useRouter, useSearchParams } from "next/navigation"

interface ReturnModalWrapperProps {
  customerName: string
  customerId: string
}

export function ReturnModalWrapper({ customerName, customerId }: ReturnModalWrapperProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOpen = searchParams.get('show_return_modal') === 'true'

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('show_return_modal')
      router.push(`?${params.toString()}`, { scroll: false })
    }
  }

  const handleConfirm = (days: number | null) => {
    const params = new URLSearchParams()
    params.set('customer_id', customerId)
    params.set('new', 'true')
    
    if (days !== null) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      params.set('date', date.toISOString().split('T')[0])
    }
    
    // Redireciona para agendamentos com os parâmetros
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