import { AppSidebar } from "@/components/app-sidebar"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"

// Este componente roda no servidor e protege as rotas
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Verificação de Segurança Global 🔒
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar Desktop (Escondida em mobile) */}
      <aside className="hidden md:block w-64 fixed inset-y-0 z-50">
        <AppSidebar />
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 md:ml-64 p-8">
        {children}
      </main>
    </div>
  )
}