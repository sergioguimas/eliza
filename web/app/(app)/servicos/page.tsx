import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { CreateServiceDialog } from "@/components/services/create-service-dialog"
import { DeleteServiceButton } from "@/components/services/delete-service-button"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"
import { CategoryIcon } from "@/components/shared/category-icon"
import { Database } from "@/utils/database.types"

type ProfileWithOrg = Database["public"]["Tables"]["profiles"]["Row"] & {
  organizations?: Pick<
    Database["public"]["Tables"]["organizations"]["Row"],
    "niche"
  > | null
}

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient<Database>()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { title: "Eliza" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organizations(niche)")
    .eq("id", user.id)
    .single()

  const niche = profile?.organizations?.niche || "generico"
  const dict = getDictionary(niche)

  const servicosTitle =
    dict.nav?.servicos ||
    dict.entities?.servico_plural

  return {
    title: `${servicosTitle} | Eliza`,
  }
}

export default async function ProcedimentosPage() {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, organizations(niche)")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) redirect("/setup")

  const organizationId = profile.organization_id
  const typedProfile = profile as ProfileWithOrg
  const niche = typedProfile.organizations?.niche || "generico"
  const dict = getDictionary(niche)

  const servicoSingular = dict.entities?.servico
  const servicoPlural = dict.entities?.servico_plural
  const pageTitle = dict.nav?.servicos || servicoPlural
  const pageDescription =
    dict.messages?.servicos_empty_description ||
    `Gerencie o catálogo de ${servicoPlural.toLowerCase()}.`
  const emptyTitle =
    dict.messages?.servicos_empty_title ||
    `Nenhum ${servicoSingular.toLowerCase()} cadastrado ainda.`
  const createLabel =
    dict.actions?.create_servico || `Novo ${servicoSingular.toLowerCase()}`

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .order("title")

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          <p className="text-muted-foreground text-sm">
            {pageDescription}
          </p>
        </div>

        <CreateServiceDialog
          organization_id={profile.organization_id}
          triggerLabel={createLabel}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services?.map((service: any) => (
          <Card
            key={service.id}
            className={cn(
              "bg-card border-border transition-all border-l-4 hover:bg-accent/50",
              !service.is_active && "opacity-60"
            )}
            style={{ borderLeftColor: service.color || "#3b82f6" }}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CategoryIcon name="servicos" className="h-5 w-5 text-primary" />
                </div>

                <div className="flex gap-2">
                  <CreateServiceDialog
                    organization_id={organizationId}
                    serviceToEdit={service}
                  />
                  <DeleteServiceButton serviceId={service.id} />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-lg text-foreground">
                  {service.title}
                </h3>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{service.duration_minutes} min</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                  <span>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(service.price || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {services?.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-xl">
            <div className="flex justify-center mb-4">
              <CategoryIcon name="servicos" className="h-12 w-12 text-muted-foreground/50" />
            </div>

            <p className="text-foreground font-medium">{emptyTitle}</p>

            {dict.messages?.servicos_empty_description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                {dict.messages.servicos_empty_description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}