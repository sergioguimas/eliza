import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const supabase = await createClient()

  // 1. Pegar usuário
  const { data: { user } } = await supabase.auth.getUser()
  
  //Se não tiver usuário, manda pro login.
  if (!user) {
    return redirect("/login")
  }
  
  // 2. Buscar dados da clínica
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenants(*)')
    .eq('id', user.id)
    .single()

  // @ts-ignore
  const tenant = profile?.tenants

  // Se não achou a clínica, mostra erro
  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-500">Erro de Configuração</h2>
        <p className="text-zinc-400">Não foi possível localizar os dados da clínica para este usuário.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Configurações da Clínica</h1>
        <p className="text-zinc-400">Gerencie os dados que aparecerão nos documentos e prontuários.</p>
      </div>

      <SettingsForm tenant={tenant} />
    </div>
  )
}