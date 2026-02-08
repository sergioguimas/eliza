import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { PublicBookingForm } from "./public-booking-form"
import { Database } from "@/utils/database.types"

export default async function PublicBookingPage({params}: {params: Promise<{ slug: string }>}) {
  const { slug } = await params;
  const supabase = await createClient<Database>()

  // 1. Busca a organização pelo slug
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!organization) notFound()

  // 2. Busca serviços e profissionais ativos
  const [servicesRes, professionalsRes] = await Promise.all([
    supabase.from('services').select('*').eq('organization_id', organization.id).eq('active', true),
    supabase.from('professionals').select('*').eq('organization_id', organization.id).eq('is_active', true)
  ])

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
          <p className="text-muted-foreground">Reserve seu horário em poucos cliques</p>
        </header>

        <PublicBookingForm 
          organizationId={organization.id}
          services={servicesRes.data || []}
          professionals={professionalsRes.data || []}
        />
      </div>
    </div>
  )
}