import { AppSidebar } from "@/components/app-sidebar"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden" // Para acessibilidade

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

  // 2. Buscar dados do Tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenants(name)')
    .eq('id', user.id)
    .single()

  // @ts-ignore
  const clinicName = profile?.tenants?.name || "Eliza"

  return (
    <div className="flex min-h-screen bg-zinc-950 flex-col md:flex-row">
      
      {/* --- DESKTOP SIDEBAR (Fixo à esquerda) --- */}
      <aside className="hidden md:block w-64 fixed inset-y-0 z-50 border-r border-zinc-800 bg-zinc-950">
        <AppSidebar clinicName={clinicName} />
      </aside>

      {/* --- MOBILE HEADER (Topo) --- */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-50">
        <div className="flex items-center gap-2">
           {/* Logo simplificado para Mobile */}
           <span className="font-bold text-zinc-100">Eliza</span>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-zinc-400">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          
          {/* Menu Lateral Mobile (Gaveta) */}
          <SheetContent side="left" className="p-0 bg-zinc-950 border-zinc-800 w-72 text-zinc-100">
            {/* Título oculto para satisfazer leitores de tela sem estragar o design */}
            <VisuallyHidden>
              <SheetTitle>Menu de Navegação</SheetTitle>
            </VisuallyHidden>
            
            {/* Reutilizamos o mesmo sidebar, removendo a borda pois o Sheet já tem */}
            <AppSidebar clinicName={clinicName} />
          </SheetContent>
        </Sheet>
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      {/* Adicionei 'md:ml-64' para dar espaço ao sidebar no desktop */}
      {/* No mobile, removemos a margem esquerda e ajustamos o padding */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-6">
        {children}
      </main>
    </div>
  )
}