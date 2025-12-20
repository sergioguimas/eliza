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

// 1. Definimos a Interface das Props para o TypeScript entender
interface AppSidebarProps {
  clinicName: string
  onNavigate?: () => void // <--- Opcional (?) porque no Desktop não usamos
}

// 2. Adicionamos 'onNavigate' na desestruturação dos parâmetros 👇
export function AppSidebar({ clinicName, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
    toast.success("Saiu com sucesso")
    // Se a função existir (mobile), chama ela para fechar o menu
    onNavigate?.() 
  }

  return (
    // Removemos 'border-r' daqui para evitar borda dupla no Sheet do mobile
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100 w-full">
      <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Stethoscope className="h-6 w-6 text-blue-500" />
        </div>
        
        <div className="flex flex-col">
          <span className="text-base font-bold text-zinc-100 leading-none">
            MedAgenda
          </span>
          <span className="text-xs text-blue-400 font-medium truncate max-w-[130px]" title={clinicName}>
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
              // 3. Aqui usamos a função. Se for undefined (Desktop), não faz nada.
              onClick={onNavigate}
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