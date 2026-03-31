'use client'

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Home,
  LogOut,
  Settings,
  ShieldAlert,
  User,
  Users,
} from "lucide-react"

import { createClient } from "@/utils/supabase/client"
import { useKeckleon } from "@/providers/keckleon-provider"
import { CategoryIcon } from "@/components/shared/category-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AppSidebarProps {
  user: any
  organization: any
  profile: any
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  nicheIconName?: "logo" | "clientes" | "servicos" | "agenda" | "dashboard" | "documentos"
  ownerOnly?: boolean
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

const SIDEBAR_STORAGE_KEY = "eliza:sidebar-collapsed"

export function AppSidebar({ user, organization, profile }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { dict, niche, meta } = useKeckleon()

  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (saved === "true") setCollapsed(true)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [collapsed, hydrated])

  const role = profile?.role || "staff"
  const isOwner = role === "owner"
  const isSuperAdmin = user?.email === process.env.NEXT_PUBLIC_GOD_EMAIL

  const userInitials = profile?.full_name
    ? profile.full_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.refresh()
  }

  const operationalItems: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard", icon: Home, nicheIconName: "dashboard" },
      { href: "/agendamentos", label: "Agendamentos", icon: Calendar, nicheIconName: "agenda" },
      { href: "/clientes", label: `Meus ${dict.label_cliente}s`, icon: Users, nicheIconName: "clientes" },
      { href: "/servicos", label: `Meus ${dict.label_servico}s`, icon: Clock, nicheIconName: "servicos" },
    ],
    [dict.label_cliente, dict.label_servico]
  )

  const managementItems: NavItem[] = useMemo(
    () => [
      { href: "/configuracoes", label: "Configurações", icon: Settings, ownerOnly: true },
      { href: "/configuracoes/equipe", label: "Minha Equipe", icon: Users, ownerOnly: true },
      { href: "/configuracoes/horarios", label: "Horários", icon: Clock, ownerOnly: true },
    ],
    []
  )

  const visibleManagementItems = managementItems.filter((item) => !item.ownerOnly || isOwner)
  const mobileItems = operationalItems.slice(0, 4)

  return (
    <>
      <aside
        className={cn(
          "sidebar-panel relative hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 md:flex md:flex-col",
          collapsed ? "md:w-[88px]" : "md:w-[280px]"
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "sidebar-floating-toggle absolute right-[5px] top-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-brand bg-background text-foreground shadow-brand transition-all duration-300 hover:scale-105"
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>

        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
            <CategoryIcon name="logo" className="size-5" />
          </div>

          <div
            className={cn(
              "min-w-0 overflow-hidden transition-all duration-300",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="truncate text-sm font-semibold">
              {organization?.name || meta.appTitle}
            </p>
            <p className="truncate text-xs text-muted-foreground text-wrap">
              {niche === "generico" ? meta.sidebarLabel : dict.msg_boas_vindas}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarSection
            title="Operacional"
            items={operationalItems}
            pathname={pathname}
            collapsed={collapsed}
          />

          {visibleManagementItems.length > 0 && (
            <div className="mt-6">
              <SidebarSection
                title={meta.sidebarLabel}
                items={visibleManagementItems}
                pathname={pathname}
                collapsed={collapsed}
              />
            </div>
          )}
        </div>

        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center rounded-2xl border border-sidebar-border bg-background/60 px-2 py-2 text-left transition hover:bg-accent",
                  collapsed ? "justify-center" : "gap-3"
                )}
              >
                <Avatar className="h-10 w-10 rounded-xl">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="rounded-xl">{userInitials}</AvatarFallback>
                </Avatar>

                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {profile?.full_name || "Usuário"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {role === "owner" ? "Admin" : role === "professional" ? "Profissional" : "Staff"}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" side="top" className="w-60 rounded-xl">
              {isSuperAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center cursor-pointer font-medium text-purple-600">
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Painel Super Admin
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem asChild>
                <Link href="/configuracoes" className="flex items-center cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Meu Perfil
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {mobileItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium transition-all duration-200",
                  active
                    ? "sidebar-item-active"
                    : "sidebar-item-hover"
                )}
              >
                {item.nicheIconName ? (
                  <CategoryIcon name={item.nicheIconName} className="mb-1 size-5" />
                ) : (
                  <item.icon className="mb-1 h-5 w-5" />
                )}
                <span className="truncate">{item.label.replace("Meus ", "")}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function SidebarSection({
  title,
  items,
  pathname,
  collapsed,
}: {
  title: string
  items: NavItem[]
  pathname: string
  collapsed: boolean
}) {
  const isSectionActive = items.some(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  )

  return (
    <section>
      {!collapsed && (
        <p
          className={cn(
            "mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
            isSectionActive ? "text-brand" : "text-muted-foreground"
          )}
        >
          {title}
        </p>
      )}

      <div className="space-y-1">
        {items.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center rounded-2xl transition-all duration-200",
                "hover:translate-x-1",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3",
                active
                  ? "bg-brand-soft text-brand shadow-brand"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl transition-colors",
                  active ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {item.nicheIconName ? (
                  <CategoryIcon name={item.nicheIconName} className="size-5" />
                ) : (
                  <item.icon className="size-5" />
                )}
              </span>

              {!collapsed && <span className="truncate text-sm font-medium">{item.label}</span>}

              {collapsed && (
                <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 rounded-lg bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}