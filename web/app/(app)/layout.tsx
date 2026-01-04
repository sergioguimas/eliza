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
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from('profiles')
    .select('organizations(name)')
    .eq('id', user.id)
    .single()

  // @ts-ignore
  const clinicName = profile?.organizations?.name || "Eliza"

  return (
    <div className="flex min-h-screen bg-background flex-col md:flex-row">
      {/* Sidebar para Desktop */}
      <aside className="hidden md:block w-64 fixed inset-y-0 z-50 border-r border-sidebar-border bg-sidebar">
        <AppSidebar clinicName={clinicName} />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-50">
        <div className="flex items-center gap-2">
           <span className="font-bold text-foreground">Eliza</span>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          
          <SheetContent side="left" className="p-0 bg-sidebar border-sidebar-border w-72 text-sidebar-foreground">
            <VisuallyHidden>
              <SheetTitle>Menu de Navegação</SheetTitle>
            </VisuallyHidden>
            <AppSidebar clinicName={clinicName} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 pt-6">
        {children}
      </main>
    </div>
  )
}