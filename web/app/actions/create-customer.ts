'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()

  // 1. Captura e Tratamento de Dados
  const name = formData.get('name') as string
  const phoneRaw = formData.get('phone') as string
  const email = formData.get('email') as string || null
  const document = formData.get('document') as string || null 
  const gender = formData.get('gender') as string || null
  const address = formData.get('address') as string || null
  const notes = formData.get('notes') as string || null
  const birthDateRaw = formData.get('birth_date') as string || null

  // 2. Validações Fail-Fast
  if (!name || !phoneRaw) {
    return { error: "Nome e Telefone são obrigatórios." }
  }

  // Sanitização simples
  const phone = phoneRaw.replace(/\D/g, '')

  try {
    // 3. Verifica Organização
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Usuário não autenticado." }

    // Busca o ID da organização
    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const profile = rawProfile as any

    if (!profile?.organization_id) {
      return { error: "Você não pertence a uma organização." }
    }

    // 4. Verificação de Duplicidade
    const query = (supabase.from('customers') as any)
      .select('id')
      .eq('organization_id', profile.organization_id)
      .or(`phone.eq.${phone}${document ? `,document.eq.${document}` : ''}`)
    
    const { data: existing } = await query

    if (existing && existing.length > 0) {
      return { error: "Já existe um cliente com este telefone ou documento." }
    }

    // 5. Inserção
    const { error: insertError } = await (supabase.from('customers') as any)
      .insert({
        organization_id: profile.organization_id,
        name,
        phone,
        email,
        document,
        gender,
        address,
        notes,
        birth_date: birthDateRaw ? new Date(birthDateRaw).toISOString() : null,
        active: true
      })

    if (insertError) {
      console.error("Erro Supabase:", insertError)
      return { error: "Erro ao cadastrar cliente. Verifique os dados." }
    }

    // 6. Revalidação
    revalidatePath('/clientes')
    revalidatePath('/dashboard')

    return { success: true, message: "Cliente cadastrado com sucesso!" }

  } catch (err) {
    console.error("Erro interno:", err)
    return { error: "Erro inesperado no servidor." }
  }
}