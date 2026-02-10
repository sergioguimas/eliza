'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateExpenseStatus(expenseId: string, newStatus: 'paid' | 'pending') {
  const supabase = await createClient()

  const { error } = await supabase
    .from('expenses')
    .update({ 
      status: newStatus,
      payment_date: newStatus === 'paid' ? new Date().toISOString() : null 
    })
    .eq('id', expenseId)

  if (error) {
    console.error("Erro ao atualizar despesa:", error)
    return { error: "Falha ao atualizar status." }
  }

  revalidatePath('/dashboard/financas')
  return { success: true }
}