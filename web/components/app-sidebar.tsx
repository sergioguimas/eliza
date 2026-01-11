'use client'

import { 
  Calendar, 
  Home, 
  Settings, 
  LogOut, 
  User, 
  Stethoscope, 
  Scissors, 
  Briefcase, 
  Sparkles,
  Users
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { useKeckleon } from "@/providers/keckleon-provider"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Tipagem das props que o Layout está enviando
interface AppSidebarProps {
  user: any
  organization: any
}

export function AppSidebar({ user, organization }: AppSidebarProps) {
  const router = useRouter()
  const { dict, niche } = useKeckleon() // <--- O Keckleon entra em ação aqui!
  const supabase = createClient()

  // 1. Lógica do Ícone Principal (Logo)
  // Se for barbearia usa Tesoura, se for clínica usa Estetoscópio, senão usa Maleta
  const MainIcon = niche === 'barbearia' ? Scissors : 
                   niche === 'clinica' ? Stethoscope : Briefcase

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  // Define iniciais para o Avatar
  const initials = organization?.name 
    ? organization.name.substring(0, 2).toUpperCase() 
    : "EL"

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MainIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{organization?.name || "Eliza SaaS"}</span>
            <span className="truncate text-xs text-muted-foreground">
              {niche === 'generico' ? 'Gestão Inteligente' : dict.msg_boas_vindas}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/dashboard">
                    <Home />
                    <span>Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/agendamentos">
                    <Calendar />
                    <span>Agendamentos</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/clientes">
                    <Users />
                    {/* AQUI ESTÁ A MÁGICA: O texto muda sozinho */}
                    <span>Meus {dict.label_cliente}s</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/servicos">
                    <Sparkles />
                    <span>Meus {dict.label_servico}s</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/configuracoes">
                    <Settings />
                    <span>Configurações</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.email}</span>
                    <span className="truncate text-xs">{dict.label_profissional}</span>
                  </div>
                  <User className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={handleSignOut} className="text-red-500 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair do Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}