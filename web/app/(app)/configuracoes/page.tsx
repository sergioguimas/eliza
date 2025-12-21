import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { SettingsForm } from "./settings-form"
import { ProfileForm } from "./profile-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")
  
  // Buscar Profile E Tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single()

  // @ts-ignore
  const tenant = profile?.tenants

  if (!tenant) return <div>Erro ao carregar dados.</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Ajustes</h1>
        <p className="text-zinc-400">Gerencie os dados da clínica e do seu perfil profissional.</p>
      </div>

      <Tabs defaultValue="clinic" className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 w-full justify-start h-auto p-1 mb-6">
          <TabsTrigger value="clinic" className="data-[state=active]:bg-zinc-800">Dados da Clínica</TabsTrigger>
          <TabsTrigger value="profile" className="data-[state=active]:bg-zinc-800">Meu Perfil</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <SettingsForm tenant={tenant} />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileForm profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  )
}