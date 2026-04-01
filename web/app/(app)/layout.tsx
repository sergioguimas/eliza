import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { KeckleonProvider } from "@/providers/keckleon-provider"
import { Database } from "@/utils/database.types"
import { getNicheMetadata } from "@/lib/niche-config"
import { ThemeToggle } from "@/components/layout/theme-toggle"

type Organization = {
  id: string
  name: string
  slug: string
  niche: "clinica" | "barbearia" | "salao" | "advocacia" | "generico" | "certificado"
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return redirect("/login")

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single()

  const profile = rawProfile as unknown as ProfileWithOrg
  const organization = profile?.organizations
  const isGodMode = user.email === process.env.NEXT_PUBLIC_GOD_EMAIL

  if (!organization && !isGodMode) {
    redirect("/setup")
  }

  const niche = organization?.niche || "generico"
  const meta = getNicheMetadata(niche)
  const nicheMeta = getNicheMetadata(niche)
  const brandVars = {
    "--brand-primary": meta.brand.primary,
    "--brand-primary-soft": meta.brand.primarySoft,
    "--brand-primary-border": meta.brand.primaryBorder,
    "--brand-primary-foreground": meta.brand.primaryForeground,
    "--brand-accent": meta.brand.accent,
    "--brand-accent-soft": meta.brand.accentSoft,
    "--brand-ring": meta.brand.ring,
    "--brand-sidebar-gradient-from": meta.brand.sidebarGradientFrom,
    "--brand-sidebar-gradient-to": meta.brand.sidebarGradientTo,
    "--brand-card-glow": meta.brand.cardGlow,
  } as React.CSSProperties

  return (
    <div className={`min-h-screen bg-background text-foreground`}>
      <KeckleonProvider niche={niche}>
        <div className="flex min-h-screen">
          <AppSidebar user={user} organization={organization} profile={profile} />

          <main className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold md:text-base">
                  {organization ? organization.name : nicheMeta.appTitle}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {nicheMeta.label}
                </p>
              </div>
              <ThemeToggle />
            </header>

            <div className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
              {children}
            </div>
          </main>
        </div>
      </KeckleonProvider>
    </div>
  )
}