'use client'

import { 
  Calendar, 
  Home, 
  Settings, 
  LogOut,
  Users,
  ShieldAlert,
  User,
  ChevronsUpDown
} from "lucide-react"

import Link from "next/link"

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
import { CategoryIcon } from "@/components/category-icon" // <--- RESTAURADO
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface AppSidebarProps {
  user: any
  organization: any
  profile: any
}

export function AppSidebar({ user, organization, profile }: AppSidebarProps) {
  const router = useRouter()
  const { dict, niche } = useKeckleon()
  const supabase = createClient()
  
  const role = profile?.role || 'staff'
  const isOwner = role === 'owner'
  const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_GOD_EMAIL
  
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  const userInitials = profile?.full_name 
    ? profile.full_name.substring(0, 2).toUpperCase() 
    : user?.email?.substring(0, 2).toUpperCase()

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {/* AQUI: Ícone que muda conforme o nicho (Logo) */}
            <CategoryIcon name="logo" className="size-4" />
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
          <SidebarGroupLabel>Operacional</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/dashboard">
                    <Home />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/agendamentos">
                    <Calendar />
                    <span>Agendamentos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/clientes">
                    {/* AQUI: Ícone variável de clientes */}
                    <CategoryIcon name="clientes" className="size-4" />
                    <span>Meus {dict.label_cliente}s</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/servicos">
                    {/* AQUI: Ícone variável de serviços (tesoura/estetoscópio/etc) */}
                    <CategoryIcon name="servicos" className="size-4" />
                    <span>Meus {dict.label_servico}s</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão da Clínica</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/configuracoes">
                      <Settings />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/configuracoes/equipe">
                      <Users />
                      <span>Minha Equipe</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
                    <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{profile?.full_name || "Usuário"}</span>
                    <span className="truncate text-xs capitalize text-muted-foreground">
                        {role === 'owner' ? 'Admin' : role === 'professional' ? 'Profissional' : 'Staff'}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                {isSuperAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer font-medium text-purple-600 flex items-center w-full">
                        <ShieldAlert className="mr-2 h-4 w-4" />
                        Painel Super Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                <DropdownMenuItem asChild>
                    <Link href="/configuracoes" className="cursor-pointer flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        Meu Perfil
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer focus:text-destructive">
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