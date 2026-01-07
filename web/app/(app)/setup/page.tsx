import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "../configuracoes/settings-form" // Verifique se o caminho de importação está correto para sua estrutura

export default async function SetupPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // 1. Busca Profile e Organização
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return redirect("/login")
  }

  // 2. Busca os Templates (Nova exigência do formulário)
  // Se a organização não existir ainda, retorna array vazio
  let templates: any[] = []
  
  if (profile.organization_id) {
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .eq('organization_id', profile.organization_id)
    
    if (data) templates = data
  }

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Bem-vindo ao MedAgenda</h1>
        <p className="text-muted-foreground">
          Vamos configurar os dados da sua clínica para começar.
        </p>
      </div>
      
      {/* Agora passamos todas as propriedades que o SettingsForm exige */}
      <SettingsForm 
        profile={profile} 
        organization={profile.organizations} 
        templates={templates} 
      />
    </div>
  )
}