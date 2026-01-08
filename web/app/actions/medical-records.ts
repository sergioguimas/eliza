'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

// Definindo o tipo para garantir que o TypeScript entenda o status
type RecordStatus = 'draft' | 'signed'

export async function saveDraft(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Verificação de Autenticação (Resolve erro de string | undefined)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.id) {
    throw new Error("Usuário não autenticado")
  }
  
  // 2. Busca do Perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 3. Verificação de Perfil e Organização (Resolve erro de string | null)
  if (!profile || !profile.organization_id) {
    throw new Error("Perfil não encontrado ou sem organização vinculada")
  }

  const recordId = formData.get('id') as string | null
  const customerId = formData.get('customer_id') as string
  const content = formData.get('content') as string

  // Objeto preparado com tipos garantidos
  const dataToSave = {
    content,
    customer_id: customerId,
    organization_id: profile.organization_id, // Agora o TS sabe que não é null
    professional_id: profile.id,
    status: 'draft' as RecordStatus, // Força o tipo correto do Enum
    updated_at: new Date().toISOString()
  }

  let error
  if (recordId) {
    // Atualiza existente
    const result = await supabase
        .from('medical_records')
        .update(dataToSave)
        .eq('id', recordId)
    error = result.error
  } else {
    // Cria novo
    const result = await supabase
        .from('medical_records')
        .insert(dataToSave)
    error = result.error
  }

  if (error) {
    console.error("Erro Supabase:", error)
    throw new Error("Erro ao salvar: " + error.message)
  }
  
  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}

export async function signRecord(recordId: string, customerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Usuário não autenticado")

  const { error } = await supabase
    .from('medical_records')
    .update({
      status: 'signed' as RecordStatus,
      signed_at: new Date().toISOString(),
      signed_by: user.id
    })
    .eq('id', recordId)

  if (error) throw new Error("Erro ao finalizar registro")

  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}

export async function deleteRecord(recordId: string, customerId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('medical_records').delete().eq('id', recordId)
  
  if (error) throw new Error("Erro ao excluir")
  
  revalidatePath(`/clientes/${customerId}`)
  return { success: true }
}