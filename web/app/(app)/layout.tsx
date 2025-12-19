import { AppSidebar } from "@/components/app-sidebar"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Verificação de Segurança
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  // 2. Buscar o Nome da Clínica (Tenant)
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenants(name)') // Busca o nome na tabela relacionada
    .eq('id', user.id)
    .single()

  // Define um nome padrão caso venha vazio
  // @ts-ignore
  const clinicName = profile?.tenants?.name || "MedAgenda"

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className="hidden md:block w-64 fixed inset-y-0 z-50">
        {/* AQUI É O PULO DO GATO: Passando o nome via prop 👇 */}
        <AppSidebar clinicName={clinicName} />
      </aside>

      <main className="flex-1 md:ml-64 p-8">
        {children}
      </main>
    </div>
  )
}