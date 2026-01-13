import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { getDictionary } from "@/lib/get-dictionary"
import { KeckleonProvider } from "@/providers/keckleon-provider"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
  
  // Se não tiver organização e não for admin do sistema, manda pro setup
  if (!organization && !user.email?.includes('admin')) {
      redirect('/setup')
  }
  
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
          {/* AQUI A MUDANÇA: Passamos o 'profile' completo */}
          <AppSidebar 
            user={user} 
            organization={organization} 
            profile={profile}
          />
          
          {/* Conteúdo Principal */}
          <main className="flex-1 w-full overflow-hidden flex flex-col">
            {/* Header com botão para abrir/fechar sidebar */}
            <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-medium">
                {organization?.name || "Eliza SaaS"}
              </h1>
            </header>
            
            {/* Área de scroll do conteúdo */}
            <div className="flex-1 overflow-auto p-4 md:p-8">
              {children}
            </div>
          </main>
        </SidebarProvider>
      </KeckleonProvider>
    </div>
  )
}