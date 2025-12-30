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
  { href: "/servicos", icon: Activity, label: "Procedimentos" }, // Ícone Activity é bom para exames/procedimentos
  { href: "/clientes", icon: Users, label: "Pacientes" },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    toast.success("Saiu com sucesso")
  }

  return (
    <div className="flex h-full flex-col border-r bg-zinc-950 text-zinc-100 w-64">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <Stethoscope className="h-6 w-6" /> {/* Ícone Médico */}
          Eliza
        </h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive 
                  ? "bg-blue-500/10 text-blue-400" 
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/30"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}