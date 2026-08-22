import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { PublicBookingForm } from "./public-booking-form"
import { Database } from "@/utils/database.types"
import { Metadata } from "next"

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient<Database>()
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("slug", slug)
    .single()

  if (!org) return { title: { absolute: "Agendamento" } }

  return {
    // `absolute` evita o template "%s | Eliza" do layout raiz: esta página é da
    // organização, não da Eliza — mesma razão pela qual o selo da Sola não entra aqui.
    title: { absolute: `Agendar — ${org.name}` },
    description: `Reserve seu horário em ${org.name}.`,
    openGraph: {
      title: `Agendar — ${org.name}`,
      description: `Reserve seu horário em ${org.name}.`,
      type: "website",
    },
  }
}

export default async function PublicBookingPage({params}: {params: Promise<{ slug: string }>}) {
  const { slug } = await params;
  const supabase = await createClient<Database>()

  // 1. Busca a organização pelo slug
  // Colunas explícitas: o papel anon só tem SELECT nas colunas públicas da org
  // (credenciais da Evolution e dados de billing ficam fora do alcance).
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug, niche')
    .eq('slug', slug)
    .single()

  if (!organization) notFound()

  // 2. Busca serviços e profissionais ativos
  const [servicesRes, professionalsRes] = await Promise.all([
    supabase.from('services').select('*').eq('organization_id', organization.id).eq('is_active', true),
    supabase.from('professionals').select('*').eq('organization_id', organization.id).eq('is_active', true)
  ])

  return (
    <div className={`theme-${organization.niche ?? "generico"} min-h-screen bg-background py-10 px-4`}>
      <div className="mx-auto w-full max-w-[1400px] space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
          <p className="text-muted-foreground">Reserve seu horário em poucos cliques</p>
        </header>

        <PublicBookingForm
          organizationId={organization.id}
          organizationNiche={organization.niche}
          organizationName={organization.name}
          services={servicesRes.data || []}
          professionals={professionalsRes.data || []}
        />
      </div>
    </div>
  )
}
