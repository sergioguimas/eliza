'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createExpense(formData: FormData) {
  const supabase = await createClient()

  const description = formData.get('description') as string
  const amount = Number(formData.get('amount'))
  const due_date = formData.get('due_date') as string
  const organization_id = formData.get('organization_id') as string
  const status = formData.get('status') as string // 'pending' ou 'paid'

  const { error } = await supabase
    .from('expenses')
    .insert({
      description,
      amount,
      due_date,
      organization_id,
      status,
      payment_date: status === 'paid' ? new Date().toISOString() : null
    })

  if (error) {
    console.error("Erro ao criar despesa:", error)
    return { error: "Falha ao registrar despesa." }
  }

  revalidatePath('/dashboard/financas')
  return { success: true }
}