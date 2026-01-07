import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./settings-form"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca Perfil e Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div>Erro: Organização não encontrada.</div>
  }

  // 3. NOVO: Busca os Templates de Mensagem
  const { data: templates } = await supabase
    .from('message_templates')
    .select('*')
    .eq('organization_id', profile.organization_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os dados da sua clínica, perfil e integrações.
        </p>
      </div>

      {/* Passamos os templates para o formulário */}
      <SettingsForm 
        profile={profile} 
        organization={profile.organizations} 
        templates={templates || []} 
      />
    </div>
  )
}