'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { Database } from "@/utils/database.types"

// --- TYPES ---
export interface ServiceRecord {
  id: string
  content: string
  status: 'draft' | 'signed'
  created_at: string
  signed_at?: string | null
  signed_by?: string | null
  professional?: { full_name: string | null }
  signature_hash?: string | null
}

// 1. BUSCAR (GET)
export async function getServiceRecords(customerId: string) {
  const supabase = await createClient<Database>()

  const { data, error } = await (supabase.from('service_records'))
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

  return data as ServiceRecord[]
}

// 2. CRIAR (CREATE)
export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient<Database>()
  
  const customerId = formData.get('customer_id') as string
  const content = formData.get('content') as string
  
  if (!customerId || !content) return { error: 'Conteúdo obrigatório' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Organização não encontrada' }

  const { error } = await (supabase.from('service_records'))
    .insert({
      organization_id: profile.organization_id,
      customer_id: customerId,
      professional_id: user.id,
      content,
      status: 'draft', // Sempre nasce como rascunho
    })

  if (error) return { error: 'Erro ao salvar registro' }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}

// 3. EDITAR (UPDATE)
export async function updateServiceRecord(recordId: string, content: string, customerId: string) {
  const supabase = await createClient()
  
  // Verifica se já está assinado antes de permitir edição
  const { data: existing } = await supabase
    .from('service_records')
    .select('status')
    .eq('id', recordId)
    .single()
    
  if (existing?.status === 'signed') {
    return { error: 'Registros assinados não podem ser editados.' }
  }

  const { error } = await supabase
    .from('service_records')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', recordId)

  if (error) return { error: 'Erro ao atualizar' }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}

// 4. ASSINAR (SIGN)
export async function signServiceRecord(recordId: string, customerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Não autorizado' }

  // Busca conteúdo para gerar hash
  const { data: record } = await supabase
    .from('service_records')
    .select('content, professional_id')
    .eq('id', recordId)
    .single()

  if (!record) return { error: 'Registro não encontrado' }

  // Gera Hash SHA-256 para integridade
  const signatureString = `${record.content}|${user.id}|${new Date().toISOString()}`
  const hash = crypto.createHash('sha256').update(signatureString).digest('hex')

  const { error } = await (supabase.from('service_records'))
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signed_by: user.id,
      signature_hash: hash
    }) 
    .eq('id', recordId)

  if (error) {
    console.error("Erro Supabase ao assinar:", error.message, error.details)
    return { error: `Erro ao assinar: ${error.message}` } 
  }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}

// 5. DELETAR (DELETE - Apenas Rascunhos)
export async function deleteServiceRecord(recordId: string, customerId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('service_records')
    .delete()
    .eq('id', recordId)
    .eq('status', 'draft') // Só deleta se for rascunho

  if (error) return { error: 'Não é possível deletar registros assinados ou erro interno.' }

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}