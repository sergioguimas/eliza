import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { getDictionary } from "@/lib/get-dictionary"
import { KeckleonProvider } from "@/providers/keckleon-provider"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar" // <--- Novo import
import { Separator } from "@/components/ui/separator"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  const organization = profile?.organizations
  
  // Keckleon Logic
  const niche = organization?.niche || 'generico'
  const dict = getDictionary(niche)
  const themeClass = `theme-${niche}`

  return (
    // 1. Injeta o Tema CSS
    <div className={`h-full ${themeClass}`}> 
      {/* 2. Injeta o Dicionário */}
      <KeckleonProvider dictionary={dict} niche={niche}>
        {/* 3. Injeta a Lógica do Sidebar */}
        <SidebarProvider>
          <AppSidebar user={user} organization={organization} />
          
          {/* Conteúdo Principal */}
          <main className="flex-1 w-full">
            {/* Header com botão para abrir/fechar sidebar */}
            <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-medium">
                {organization?.name || "Dashboard"}
              </h1>
            </header>

            <div className="p-4">
              {children}
            </div>
          </main>
        </SidebarProvider>
      </KeckleonProvider>
    </div>
  )
}