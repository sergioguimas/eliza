'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function getServiceRecords(customerId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_records') // <--- Tabela nova
    .select(`
      *,
      professional:profiles!service_records_professional_id_fkey (
        full_name,
        role
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar registros:', error)
    return []
  }

  return data
}

export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient()
  
  const customerId = formData.get('customer_id') as string
  const content = formData.get('content') as string
  const status = (formData.get('status') as 'draft' | 'signed') || 'draft'

  if (!customerId || !content) {
    return { error: 'Conteúdo obrigatório' }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Identificar a Organização do usuário atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user?.id!)
    .single()

  if (!profile?.organization_id) return { error: 'Sem organização vinculada' }

  // 2. Criar o Registro
  const { error } = await supabase
    .from('service_records')
    .insert({
      organization_id: profile.organization_id,
      customer_id: customerId,
      professional_id: user?.id, // Quem criou o registro
      content,
      status,
      signed_at: status === 'signed' ? new Date().toISOString() : null,
      signed_by: status === 'signed' ? user?.id : null
    })

  if (error) {
    console.error(error)
    return { error: 'Erro ao salvar registro' }
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}