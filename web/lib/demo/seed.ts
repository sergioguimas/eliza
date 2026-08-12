import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/utils/database.types"
import type { DemoNiche } from "@/lib/demo/config"
import { DEMO_FIXTURES } from "@/lib/demo/fixtures"

type AdminClient = SupabaseClient<Database>

const TZ = "America/Sao_Paulo"

/**
 * São Paulo é UTC-3 fixo — o horário de verão acabou em 2019. O restante do
 * código (cron de lembretes) já assume o mesmo, então manter a premissa aqui
 * evita duas noções de tempo no mesmo produto.
 */
const SP_UTC_OFFSET_HOURS = 3

/** Jornada dos profissionais semeados: dias úteis, com pausa ao meio-dia. */
const WORKDAY = {
  start: "09:00:00",
  breakStart: "12:00:00",
  breakEnd: "13:00:00",
  end: "18:00:00",
  days: [1, 2, 3, 4, 5],
} as const

function saoPauloToday() {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number)

  return { year, month, day }
}

/**
 * Monta um instante a partir do calendário de São Paulo. `Date.UTC` normaliza
 * o estouro de dia e mês, então somar offsets negativos ou grandes é seguro.
 */
function saoPauloDateTime(daysOffset: number, hour: number, minute = 0) {
  const today = saoPauloToday()

  return new Date(
    Date.UTC(
      today.year,
      today.month - 1,
      today.day + daysOffset,
      hour + SP_UTC_OFFSET_HOURS,
      minute
    )
  )
}

/**
 * Empurra o offset até cair em dia útil.
 *
 * Sem isso, a agenda semeada numa sexta-feira colocaria compromissos no sábado
 * ou domingo — dias em que o profissional criado aqui não atende, o que faria
 * a demonstração se contradizer logo na primeira tela.
 */
function toWeekday(daysOffset: number, direction: 1 | -1) {
  const today = saoPauloToday()
  let offset = daysOffset

  for (let i = 0; i < 7; i++) {
    const weekday = new Date(
      Date.UTC(today.year, today.month - 1, today.day + offset)
    ).getUTCDay()

    if (weekday !== 0 && weekday !== 6) return offset

    offset += direction
  }

  return offset
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function saoPauloHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  )
}

function isWeekday(daysOffset: number) {
  const today = saoPauloToday()
  const weekday = new Date(
    Date.UTC(today.year, today.month - 1, today.day + daysOffset)
  ).getUTCDay()

  return weekday !== 0 && weekday !== 6
}

/**
 * Escolhe quando cai o compromisso que ainda vai acontecer.
 *
 * Os contadores de destaque do dashboard são todos de *hoje*. Jogar o único
 * compromisso futuro para depois de amanhã faria o visitante chegar numa tela
 * com "0 hoje" — exatamente a sensação de sistema parado que a demonstração
 * existe para desfazer.
 *
 * Então fica hoje sempre que ainda couber na jornada, com uma folga de duas
 * horas para o passo do lembrete da Fase 8 fazer sentido (o lembrete sai 1h
 * antes). Fora disso, vai para o próximo dia útil.
 */
function upcomingSlot(): { dayOffset: number; hour: number } {
  const candidate = saoPauloHour() + 2

  // 12h cai dentro da pausa criada logo acima. Marcar ali deixaria a agenda em
  // contradição com a disponibilidade do próprio profissional.
  const nextHour = candidate === 12 ? 13 : candidate

  if (isWeekday(0) && nextHour <= 17) {
    return { dayOffset: 0, hour: nextHour }
  }

  return { dayOffset: toWeekday(1, 1), hour: 14 }
}

/**
 * Popula um tenant de demonstração com profissionais, serviços, clientes e uma
 * agenda plausível: dois atendimentos concluídos, um registro já preenchido e
 * um compromisso futuro.
 *
 * O objetivo é que o visitante caia num sistema em uso, não num formulário
 * vazio — a primeira tela precisa parecer o negócio dele já rodando.
 *
 * Todas as datas são relativas a agora. Nada de literal de calendário, que
 * envelhece e faz a demonstração nascer com a agenda no passado.
 */
export async function seedDemoOrganization(
  supabaseAdmin: AdminClient,
  {
    organizationId,
    niche,
    ownerProfileId,
  }: { organizationId: string; niche: DemoNiche; ownerProfileId: string }
): Promise<{ ok: boolean; error?: string }> {
  const fixture = DEMO_FIXTURES[niche]

  // O trigger `handle_new_organization` já criou um profissional padrão
  // ("Atendimento") junto com a organização. Inserir os dois do fixture por
  // cima deixaria três, sendo um sem disponibilidade nem agenda — um fantasma
  // logo na primeira tela. Então o padrão é reaproveitado como o primeiro.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("professionals")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })

  if (existingError) {
    return { ok: false, error: `profissionais existentes: ${existingError.message}` }
  }

  const professionals: { id: string }[] = []
  const [firstFixture, secondFixture] = fixture.professionals
  const defaultProfessional = existing?.[0]

  if (defaultProfessional) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("professionals")
      .update({
        name: firstFixture.name,
        specialty: firstFixture.specialty,
        phone: firstFixture.phone,
        is_active: true,
      })
      .eq("id", defaultProfessional.id)
      .select("id")
      .single()

    if (updateError || !updated) {
      return {
        ok: false,
        error: `profissional padrão: ${updateError?.message ?? "sem retorno"}`,
      }
    }

    professionals.push(updated)
  }

  const pending = defaultProfessional
    ? [secondFixture]
    : [firstFixture, secondFixture]

  const { data: inserted, error: professionalsError } = await supabaseAdmin
    .from("professionals")
    .insert(
      pending.map((professional) => ({
        organization_id: organizationId,
        name: professional.name,
        specialty: professional.specialty,
        phone: professional.phone,
        is_active: true,
      }))
    )
    .select("id")

  if (professionalsError || !inserted?.length) {
    return {
      ok: false,
      error: `profissionais: ${professionalsError?.message ?? "sem retorno"}`,
    }
  }

  professionals.push(...inserted)

  const { error: availabilityError } = await supabaseAdmin
    .from("professional_availability")
    .insert(
      professionals.flatMap((professional) =>
        WORKDAY.days.map((day) => ({
          professional_id: professional.id,
          day_of_week: day,
          start_time: WORKDAY.start,
          break_start: WORKDAY.breakStart,
          break_end: WORKDAY.breakEnd,
          end_time: WORKDAY.end,
          is_active: true,
        }))
      )
    )

  if (availabilityError) {
    return { ok: false, error: `disponibilidade: ${availabilityError.message}` }
  }

  const { data: services, error: servicesError } = await supabaseAdmin
    .from("services")
    .insert(
      fixture.services.map((service) => ({
        organization_id: organizationId,
        title: service.title,
        description: service.description,
        duration_minutes: service.durationMinutes,
        price: service.price,
        is_active: true,
      }))
    )
    .select("id, duration_minutes, price")

  if (servicesError || !services?.length) {
    return { ok: false, error: `serviços: ${servicesError?.message ?? "sem retorno"}` }
  }

  const { data: customers, error: customersError } = await supabaseAdmin
    .from("customers")
    .insert(
      fixture.customers.map((customer) => ({
        organization_id: organizationId,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
        active: true,
      }))
    )
    .select("id")

  if (customersError || !customers?.length) {
    return { ok: false, error: `clientes: ${customersError?.message ?? "sem retorno"}` }
  }

  // Os dois primeiros ficam no passado e entram como concluídos; o terceiro é o
  // compromisso à frente, que o tour usa como ponto de partida.
  const upcoming = upcomingSlot()

  const plan = [
    { dayOffset: toWeekday(-7, -1), hour: 10, professional: 0, service: 0, customer: 0, past: true },
    { dayOffset: toWeekday(-3, -1), hour: 15, professional: 1, service: 1, customer: 1, past: true },
    { ...upcoming, professional: 0, service: 0, customer: 0, past: false },
  ]

  const appointmentRows = plan.map((item) => {
    const service = services[item.service]
    const startTime = saoPauloDateTime(item.dayOffset, item.hour)

    return {
      organization_id: organizationId,
      customer_id: customers[item.customer].id,
      service_id: service.id,
      professional_id: professionals[item.professional].id,
      start_time: startTime.toISOString(),
      end_time: addMinutes(startTime, service.duration_minutes).toISOString(),
      // `completed` fica fora do índice de exclusão por profissional, então os
      // atendimentos passados nunca colidem com o que o visitante criar depois.
      status: item.past ? "completed" : "scheduled",
      price: service.price,
      payment_status: item.past ? "paid" : "pending",
      payment_method: item.past ? "pix" : null,
      paid_at: item.past ? startTime.toISOString() : null,
    }
  })

  const { data: appointments, error: appointmentsError } = await supabaseAdmin
    .from("appointments")
    .insert(appointmentRows)
    .select("id")

  if (appointmentsError || !appointments?.length) {
    return {
      ok: false,
      error: `agendamentos: ${appointmentsError?.message ?? "sem retorno"}`,
    }
  }

  // Um registro já preenchido no cliente recorrente: sem isso, o histórico
  // aparece vazio e o passo do prontuário no tour não tem contexto nenhum.
  const { error: recordError } = await supabaseAdmin
    .from("service_records")
    .insert({
      organization_id: organizationId,
      customer_id: customers[0].id,
      professional_id: professionals[0].id,
      appointment_id: appointments[0].id,
      created_by_profile_id: ownerProfileId,
      content: fixture.recordContent,
      status: "finalized",
    })

  if (recordError) {
    return { ok: false, error: `registro: ${recordError.message}` }
  }

  return { ok: true }
}
