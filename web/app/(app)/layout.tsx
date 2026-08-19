import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { KeckleonProvider } from "@/providers/keckleon-provider"
import { Database } from "@/utils/database.types"
import { getNicheMetadata } from "@/lib/niche-config"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { TourGuide } from "@/components/demo/tour-guide"

type Organization = {
  id: string
  name: string
  slug: string
  niche: "clinica" | "psicologia" | "barbearia" | "salao" | "advocacia" | "generico" | "certificado" | "tatuador"
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

  // Colunas explícitas na org: o papel authenticated só tem SELECT nas colunas
  // públicas (id, name, slug, niche). `organizations(*)` daria 42501 — e era
  // por ele que billing e whatsapp_instance_name vazavam para o client.
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*, organizations(id, name, slug, niche)")
    .eq("id", user.id)
    .single()

  const profile = rawProfile as unknown as ProfileWithOrg
  const organization = profile?.organizations
  const isGodMode = user.email === process.env.NEXT_PUBLIC_GOD_EMAIL

  if (!organization && !isGodMode) {
    redirect("/setup")
  }

  // O papel `authenticated` não enxerga `organizations.is_demo` (grant de
  // coluna), então a marca vem do metadata do usuário, que já está na sessão e
  // não custa consulta nenhuma. Serve para decidir se um balão aparece na tela;
  // o que vira telemetria é revalidado no servidor, em `logDemoInteraction`.
  const isDemoVisitor = user.user_metadata?.is_demo === true

  const niche = organization?.niche || "generico"
  const meta = getNicheMetadata(niche)

  return (
    <div className={`theme-${niche} min-h-screen bg-background text-foreground`}>
      <KeckleonProvider niche={niche}>
        {isDemoVisitor && organization && (
          <TourGuide organizationId={organization.id} niche={niche} />
        )}

        <div className="flex min-h-screen">
          <AppSidebar user={user} organization={organization} profile={profile} />

          <main className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold md:text-base">
                  {organization ? organization.name : meta.appTitle}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {meta.label}
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
