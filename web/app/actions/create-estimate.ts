'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

export async function createEstimate(formData: FormData) {
  const supabase = await createClient<Database>()

  // 1. Extração de Dados Base
  const organization_id = formData.get('organization_id') as string
  const customer_id = formData.get('customer_id') as string
  const professional_id = formData.get('professional_id') as string
  const notes = formData.get('notes') as string
  const expiration_date = formData.get('expiration_date') as string

  // 2. Processamento dos Itens (Enviados como JSON string pelo formulário)
  const itemsRaw = formData.get('items_json') as string
  const items = JSON.parse(itemsRaw || '[]')
  
  // Cálculo do total no servidor para evitar manipulação no front
  const total_amount = items.reduce((acc: number, item: any) => 
    acc + (Number(item.price) * Number(item.quantity || 1)), 0
  )

  if (!organization_id || !customer_id || items.length === 0) {
    return { error: "Dados insuficientes para gerar o orçamento." }
  }

  // 3. Persistência
  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      organization_id,
      customer_id,
      professional_id: professional_id || null,
      items,
      total_amount,
      notes,
      expiration_date: expiration_date || null,
      status: 'pending'
    })
    .select('id')
    .single()

  if (error) {
    console.error("Erro ao salvar orçamento:", error)
    return { error: "Falha ao gravar os dados no banco." }
  }

  revalidatePath(`/clientes/${customer_id}`)
  return { success: true, estimateId: estimate.id }
}