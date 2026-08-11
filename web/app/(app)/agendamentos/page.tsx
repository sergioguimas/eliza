import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/appointments/calendar-view"
import { RealtimeAppointments } from "@/components/layout/realtime-appointments"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"
import { Database } from "@/utils/database.types"

export const metadata: Metadata = {
  title: "Agenda | Eliza",
}

export default async function AgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient<Database>()
  const params = await searchParams

  // 1. Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role, organizations(niche)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/configuracoes')
  }

  const orgId = profile.organization_id
  const niche = profile?.organizations?.niche || 'generico'

  // 🔥 NOVO PADRÃO
  const dict = getDictionary(niche)
  const { entities, messages } = dict

  // 3. Data
  const [
    customersRes,
    servicesRes,
    staffRes,
    appointmentsRes,
    settingsRes
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name'),

    supabase
      .from('services')
      .select('id, title, color')
      .eq('organization_id', orgId)
      .eq('is_active', true),

    supabase
      .from('professionals')
      .select('id, name, specialty, phone, professional_availability (*)')
      .eq('organization_id', orgId)
      .eq('is_active', true),

    supabase
      .from('appointments')
      .select(`
        id, 
        customer_id,
        start_time, 
        end_time, 
        status, 
        professional_id,
        payment_status,
        customers ( name ), 
        services ( title, color ),
        professionals ( name )
      `)
      .eq('organization_id', orgId),

    supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', orgId)
      .single()
  ])

  const customers = customersRes.data || []
  const services = servicesRes.data || []
  const staff = staffRes.data || []
  const appointments = appointmentsRes.data || []
  const settings = settingsRes.data || {}

  return (
    <div className="space-y-8">
      <RealtimeAppointments />

      {/* Header semântico via Keckleon */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {entities.agendamento_plural}
        </h1>

        <p className="text-muted-foreground text-sm">
          {messages.agendamentos_empty_description}
        </p>
      </div>

      <CalendarView 
        appointments={appointments as any}
        customers={customers} 
        services={services}
        staff={staff}
        organization_id={orgId}
        currentUser={profile}
        settings={settings}
      />
    </div>
  )
}
