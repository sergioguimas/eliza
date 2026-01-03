'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Não autorizado')

  const name = formData.get('name') as string
  
  // Gera um slug simples: "Minha Clínica" -> "minha-clinica-x7z9"
  // O sufixo aleatório evita duplicidade de slugs.
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, '-') // Substitui espaços e especiais por traço
    + '-' + Math.random().toString(36).substring(2, 7)

  // 1. Criar a organização (Sem owner_id, e com slug obrigatório)
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ 
      name, 
      slug 
    })
    .select()
    .single()

  if (orgError) {
    console.error("Erro ao criar organização:", orgError)
    return { error: orgError.message }
  }

  // 2. Vincular o usuário a essa organização no perfil dele
  // O usuário vira o "dono" implicitamente por ser o primeiro a vincular e ter role de admin/owner
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      organization_id: org.id,
      role: 'owner' // Garante que quem criou é o dono
    })
    .eq('id', user.id)

  if (profileError) {
    console.error("Erro ao vincular perfil:", profileError)
    return { error: profileError.message }
  }

  // 3. Redirecionar
  redirect('/dashboard')
}