import { createClient } from "@/utils/supabase/server"
import { SetupForm } from "./setup-form"
import { redirect } from "next/navigation"

export default async function SetupPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // Busca perfil para saber qual a organização
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return <div>Erro: Usuário sem organização vinculada. Contate o suporte.</div>
  }

  // Busca dados da organização (caso já tenha algo preenchido)
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single()

  return (
    <div className="container flex flex-col justify-center min-h-[calc(100vh-4rem)] py-10 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo à Eliza! 🎉</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Estamos felizes em ter você aqui. Vamos configurar sua clínica em poucos passos para que você possa começar a atender.
        </p>
      </div>

      <SetupForm organization={organization} />
    </div>
  )
}