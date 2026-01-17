import { createClient } from "@/utils/supabase/server"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SettingsForm } from "./settings-form"
import { PreferencesForm } from "./preferences-form"
import { Building2, CalendarClock } from "lucide-react"
import { redirect } from "next/navigation"

// --- TIPAGEM MANUAL (BLINDAGEM) ---
type ProfileRow = {
  id: string
  organization_id: string | null
  role: string
  full_name: string | null
  email: string | null
}

type OrganizationRow = {
  id: string
  name: string
  slug: string
  niche: string
  whatsapp_instance_name: string | null
  whatsapp_api_key: string | null
  whatsapp_api_url: string | null
  whatsapp_status: string | null
}

type SettingsRow = {
  organization_id: string
  open_hours_start: string | null
  open_hours_end: string | null
  days_of_week: number[] | null
  appointment_duration: number | null
  msg_appointment_created: string | null
  msg_appointment_reminder: string | null
  msg_appointment_canceled: string | null
}

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  
  // 1. Busca Usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // 2. Busca Perfil (Com Casting)
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  // Forçamos o tipo ProfileRow
  const profile = rawProfile as unknown as ProfileRow

  // 3. Busca Organização (Com Casting)
  let organization: OrganizationRow | null = null
  
  if (profile?.organization_id) {
    const { data: rawOrg } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single()
    
    organization = rawOrg as unknown as OrganizationRow
  }

  // 4. Busca Configurações (Com Casting)
  let settings: SettingsRow | null = null
  
  if (profile?.organization_id) {
    const { data: rawSettings } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single()
      
    settings = rawSettings as unknown as SettingsRow
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie os dados da empresa, conexão e automações.</p>
      </div>

      {/* ABAS */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
          <TabsTrigger value="geral" className="text-base gap-2">
            <Building2 className="h-4 w-4"/> 
            Dados & Conexão
          </TabsTrigger>
          <TabsTrigger value="agenda" className="text-base gap-2">
            <CalendarClock className="h-4 w-4"/> 
            Agenda & Bot
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: DADOS GERAIS */}
        <TabsContent value="geral" className="mt-0">
          <SettingsForm 
             // Usamos 'as any' nos props para evitar conflito se o componente filho tiver tipagem diferente
             profile={profile as any} 
             organization={organization as any} 
          />
        </TabsContent>

        {/* ABA 2: PREFERÊNCIAS */}
        <TabsContent value="agenda" className="mt-0">
           <PreferencesForm 
             settings={settings as any} 
             organizationId={profile?.organization_id || ""}
           />
        </TabsContent>

      </Tabs>
    </div>
  )
}