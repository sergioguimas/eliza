'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"
import { normalizarDataNascimento } from "@/lib/domain/clientes"
import { DomainError } from "@/lib/domain/erros"

export async function createCustomer(formData: FormData) {
  const supabase = await createClient<Database>()

  // 1. Captura e Tratamento de Dados
  const name = formData.get('name') as string
  const phoneRaw = formData.get('phone') as string
  const email = formData.get('email') as string || null
  const document = formData.get('document') as string || null 
  const gender = formData.get('gender') as string || null
  const address = formData.get('address') as string || null
  const notes = formData.get('notes') as string || null
  const birthDateRaw = formData.get('birth_date') as string || null

  // 2. Validações Fail-Fast. Desde 07/11/2026 a data de nascimento é obrigatória e o documento, opcional.
  if (!name || !phoneRaw || !birthDateRaw) {
    return { error: "Nome, telefone e data de nascimento são obrigatórios." }
  }

  let birthDate: string | null
  try {
    birthDate = normalizarDataNascimento(birthDateRaw)
  } catch (err) {
    if (err instanceof DomainError) return { error: err.message }
    throw err
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
    const query = (supabase.from('customers'))
      .select('id')
      .eq('organization_id', profile.organization_id)
      .or(`phone.eq.${phone}${document ? `,document.eq.${document}` : ''}`)
    
    const { data: existing } = await query

    if (existing && existing.length > 0) {
      return { error: "Já existe um cliente com este telefone ou documento." }
    }

    // 5. Inserção
    const { error: insertError } = await (supabase.from('customers'))
      .insert({
        organization_id: profile.organization_id,
        name,
        phone,
        email,
        document,
        gender,
        address,
        notes,
        birth_date: birthDate,
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