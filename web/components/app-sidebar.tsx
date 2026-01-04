'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Users, Settings, Activity, LogOut, LayoutDashboard, Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const menuItems = [
  { href: "/", icon: LayoutDashboard, label: "Visão Geral" },
  { href: "/agendamentos", icon: Calendar, label: "Agenda Médica" },
  { href: "/servicos", icon: Activity, label: "Procedimentos" },
  { href: "/clientes", icon: Users, label: "Pacientes" },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
]

interface AppSidebarProps {
  clinicName: string
  onNavigate?: () => void
}

export function AppSidebar({ clinicName, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    toast.success("Saiu com sucesso")
    onNavigate?.() 
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground w-full">
      <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Stethoscope className="h-6 w-6 text-blue-500" />
        </div>
        
        <div className="flex flex-col">
          <span className="text-base font-bold text-sidebar-foreground leading-none">
            Eliza
          </span>
          <span className="text-xs text-muted-foreground font-medium truncate max-w-[130px]" title={clinicName}>
            {clinicName}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}