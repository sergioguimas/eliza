'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

async function checkGodMode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const godEmail = process.env.GOD_EMAIL

  // Fail Safe: Se não configurou a variável, bloqueia tudo por segurança
  if (!godEmail) {
    console.error("ERRO CRÍTICO: GOD_EMAIL não configurado no .env")
    redirect('/dashboard')
  }

  if (!user || user.email !== godEmail) {
    redirect('/dashboard') // Chuta invasores de volta pro dashboard
  }
}

export async function toggleOrgStatus(orgId: string, currentStatus: 'active' | 'suspended') {
  await checkGodMode() // Segurança extra

  const supabaseAdmin = createAdminClient()
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active'

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ status: newStatus })
    .eq('id', orgId)

  if (error) {
    throw new Error('Erro ao atualizar status')
  }

  revalidatePath('/admin')
}