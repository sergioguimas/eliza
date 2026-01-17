'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient()

  // 1. Extrair dados do formulário
  const customerId = formData.get('customer_id') as string
  const content = formData.get('content') as string
  const status = formData.get('status') as string || 'draft'

  if (!customerId || !content) {
    return { error: "Conteúdo e Cliente são obrigatórios." }
  }

  try {
    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Usuário não autenticado." }

    // 3. Buscar Perfil (Com Válvula de Escape)
    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .single()

    const profile = rawProfile as any

    if (!profile?.organization_id) {
      return { error: 'Perfil inválido ou sem organização.' }
    }

    // 4. Salvar na tabela service_records (Com Válvula de Escape)
    const { error } = await (supabase.from('service_records') as any).insert({
      organization_id: profile.organization_id,
      customer_id: customerId,
      professional_id: profile.id, // O usuário logado é quem está criando o registro
      content: content,
      status: status,
      updated_at: new Date().toISOString()
    })

    if (error) {
      console.error("Erro ao salvar prontuário:", error)
      return { error: "Erro ao salvar o registro no banco." }
    }

    // 5. Atualizar a cache da página do cliente
    revalidatePath(`/clientes/${customerId}`)
    
    return { success: true }

  } catch (err) {
    console.error("Erro interno createServiceRecord:", err)
    return { error: "Erro inesperado." }
  }
}