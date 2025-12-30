'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createService(formData: FormData) {
  const supabase = await createClient()

  // 1. Pegar dados (Mapeando para as variáveis novas)
  const name = formData.get('title') as string // O form envia 'title', mas salvaremos como 'name'
  const price = parseFloat(formData.get('price') as string)
  const duration = parseInt(formData.get('duration') as string)
  const color = formData.get('color') as string 

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // 2. Buscar Organization (Antigo Tenant)
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id') // <--- CORRIGIDO: tenant_id -> organization_id
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return { error: 'Erro de perfil: Sem organização' }

  // 3. Inserir no Banco (Com os nomes de colunas novos)
  const { error } = await supabase.from('services').insert({
    name: name,                // <--- CORRIGIDO: title -> name
    price: price,
    duration: duration,        // <--- CORRIGIDO: duration_minutes -> duration
    // color: color,           // ⚠️ ATENÇÃO: Se seu banco não tiver a coluna 'color', comente essa linha ou crie a coluna.
    organization_id: profile.organization_id, // <--- CORRIGIDO: tenant_id -> organization_id
    active: true               // <--- CORRIGIDO: is_active -> active
  })

  if (error) {
    console.error("Erro ao criar serviço:", error)
    return { error: error.message }
  }

  revalidatePath('/servicos')
  revalidatePath('/agendamentos')
  return { success: true }
}