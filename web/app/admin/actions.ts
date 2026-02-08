'use server'

import { createClient } from "@/utils/supabase/server"
import { createClient as createClientAdmin } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { Database } from "@/utils/database.types"

// Verifica se é o Super Admin
async function checkSuperAdmin() {
  const supabase = await createClient<Database>()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || user.email !== process.env.NEXT_PUBLIC_GOD_EMAIL) {
    throw new Error("Acesso não autorizado")
  }
  return user
}

// Configura o cliente com poder de Deus (Service Role)
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error("Erro de configuração: Service Role Key não encontrada")
  }
  
  return createClientAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function toggleOrgStatus(orgId: string, currentStatus: string) {
  // 1. Segurança: Garante que é você mesmo
  await checkSuperAdmin()

  // 2. Lógica de inversão
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active'

  // 3. Executa atualização usando o Cliente Admin (ignora RLS)
  const supabaseAdmin = getAdminClient()

  const { error } = await (supabaseAdmin.from('organizations'))
    .update({ subscription_status: newStatus }) 
    .eq('id', orgId)

  if (error) {
    console.error("Erro no toggleOrgStatus:", error)
    throw new Error(`Erro ao atualizar status: ${error.message}`)
  }

  revalidatePath('/admin')
  return { success: true }
}