'use server'

import { createClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { getAvailableSlots } from "@/app/actions/get-available-slots"

export type DemoAppointmentDefaults = {
  date: string // "YYYY-MM-DD"
  time: string // "HH:MM"
  professionalId: string
  serviceId: string
  customerId: string
} | null

const MAX_DAYS_AHEAD = 10

/**
 * Calcula um horário plausível para pré-preencher o formulário de agendamento
 * do tour: um slot **real**, respeitando a disponibilidade que o próprio seed
 * criou, para o visitante não topar com "horário indisponível" no primeiro
 * clique.
 *
 * Roda inteiramente no servidor e reconfirma `is_demo` com service role — o
 * mesmo padrão do resto do código de demo — porque quem chama é sempre um
 * client component, e nada que venha do navegador é confiável para decidir
 * isso sozinho.
 */
export async function getDemoAppointmentDefaults(
  organizationId: string
): Promise<DemoAppointmentDefaults> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return null

  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, is_demo")
    .eq("id", organizationId)
    .maybeSingle()

  if (!organization?.is_demo) return null

  const [professionalsRes, servicesRes, customersRes] = await Promise.all([
    supabaseAdmin
      .from("professionals")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("services")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
  ])

  const professionalId = professionalsRes.data?.[0]?.id
  const serviceId = servicesRes.data?.[0]?.id

  // O segundo cliente do seed é o "novo" — o primeiro já carrega os
  // atendimentos passados e o registro. Agendar o segundo fecha uma lacuna
  // real da agenda semeada, em vez de empilhar mais um horário no mesmo nome.
  const customerId = customersRes.data?.[1]?.id ?? customersRes.data?.[0]?.id

  if (!professionalId || !serviceId || !customerId) return null

  for (let offset = 0; offset <= MAX_DAYS_AHEAD; offset++) {
    const candidate = new Date()
    candidate.setDate(candidate.getDate() + offset)

    const result = await getAvailableSlots(
      professionalId,
      candidate,
      organizationId
    )

    const time = result.slots[0]
    if (!time) continue

    return {
      date: candidate.toISOString().slice(0, 10),
      time,
      professionalId,
      serviceId,
      customerId,
    }
  }

  // Não achou slot em 10 dias — improvável com a disponibilidade que o seed
  // cria (5 dias úteis por semana), mas o formulário em branco continua
  // funcional. Não é motivo para quebrar a criação de agendamento.
  return null
}
