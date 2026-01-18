import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SetupForm } from "./setup-form"

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const supabase = await createClient()
  
  // 1. Verifica Autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  // 2. Verifica se JÁ tem organização (Double Check)
  // Se tiver, manda pro dashboard para evitar duplicação
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profile?.organization_id) {
    return redirect('/dashboard')
  }

  // 3. Renderiza o Formulário
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <SetupForm />
    </div>
  )
}