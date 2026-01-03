import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organization_id (*)
    `)
    .eq('id', user.id)
    .single() as any

  const { data: whatsapp } = await supabase
    .from('whatsapp_instances')
    .select('status')
    .eq('organization_id', profile?.organization_id)
    .single() as any

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100">Configurações</h2>
          <p className="text-muted-foreground">
            Gerencie as informações da sua clínica e sua conta profissional.
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <SettingsForm 
          profile={profile} 
          whatsappStatus={whatsapp?.status || 'disconnected'} 
        />
      </div>
    </div>
  )
}