import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { getDictionary } from "@/lib/get-dictionary"
import { KeckleonProvider } from "@/providers/keckleon-provider"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Database } from "@/utils/database.types"

type Organization = {
  id: string
  name: string
  slug: string
  niche: 'clinica' | 'barbearia' | 'salao' | 'advocacia' | 'generico' | 'certificado'
}

type ProfileWithOrg = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  organization_id: string | null
  organizations: Organization | null 
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient<Database>()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  // 1. Busca Perfil com Join na Organização
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  // 2. Casting Manual (Válvula de Escape)
  const profile = rawProfile as unknown as ProfileWithOrg

  const organization = profile?.organizations
  
  // 3. Lógica de Redirecionamento
  // Se não tiver organização e não for admin do sistema (God Mode), manda pro setup
  const isGodMode = user.email === process.env.NEXT_PUBLIC_GOD_EMAIL
  
  if (!organization && !isGodMode) {
      redirect('/setup')
  }
  
  const niche = organization?.niche || 'generico'
  const dict = getDictionary(niche)
  const themeClass = `theme-${niche}`

  return (
    <div className={`h-full ${themeClass} bg-background text-foreground`}> 
      <KeckleonProvider dictionary={dict} niche={niche}>
        <SidebarProvider>
          <AppSidebar 
            user={user} 
            organization={organization} 
            profile={profile}
          />
          {/* Conteúdo Principal */}
          <main className="flex-1 w-full overflow-hidden flex flex-col h-screen">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur px-4 supports-[backdrop-filter]:bg-background/60">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-sm font-medium truncate">
                {"Eliza App - " + (organization ? organization.name : "Sem Organização")}
              </h1>
            </header>
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-muted/10">
              {children}
            </div>
          </main>
        </SidebarProvider>

      </KeckleonProvider>
    </div>
  )
}