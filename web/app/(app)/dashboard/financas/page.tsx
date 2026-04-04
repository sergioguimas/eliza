import { getFinancialSummary } from "@/app/actions/get-financial-summary"
import { FinancialCards } from "@/components/dashboard/financial-cards"
import { Skeleton } from "@/components/ui/skeleton"
import { RankingList } from "@/components/dashboard/ranking-list"
import { Card } from "@/components/ui/card"
import { AddExpenseModal } from "@/components/finance/financas-add-expense-modal"
import { createClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"
import { redirect } from "next/navigation"
import { PeriodoFilter } from "@/components/finance/financas-periodo-filter"
import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { PaymentMethodChart } from "@/components/dashboard/payment-method-chart"
import { getDictionary } from "@/lib/dictionaries/get-dictionary"

interface FinancasPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type ProfileWithOrg = {
  organization_id: string | null
  organizations?: {
    niche?: string | null
  } | null
}

export default async function FinancasPage(props: FinancasPageProps) {
  const searchParams = await props.searchParams
  const periodo =
    typeof searchParams.periodo === "string" ? searchParams.periodo : undefined

  const labelPeriodo = periodo
    ? format(parseISO(`${periodo}-01`), "MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })

  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return redirect("/login")

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("organization_id, organizations(niche)")
    .eq("id", user.id)
    .single()

  const profile = rawProfile as ProfileWithOrg | null
  const organizationId = profile?.organization_id || user.id
  const niche = profile?.organizations?.niche || "generico"

  const dict = getDictionary(niche)

  const servicoSingular = dict.entities?.servico
  const profissionalSingular =
    dict.entities?.profissional

  const data = await getFinancialSummary(organizationId, periodo)

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <h1 className="text-3xl font-bold tracking-tight">Painel financeiro</h1>

      <FinancialCards data={data} />

      <div className="flex items-center justify-between space-y-2">
        <div>
          <p className="text-muted-foreground">Gestão de entradas e saídas.</p>
          <p className="text-muted-foreground capitalize">
            Análise de {labelPeriodo}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PeriodoFilter />
          <AddExpenseModal organizationId={organizationId} />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="p-6 border-border/50 shadow-sm">
          <RankingList
            title={`Faturamento por ${servicoSingular}`}
            data={data.porProcedimento}
            color="bg-indigo-500"
          />
        </Card>

        <Card className="p-6 border-border/50 shadow-sm">
          <RankingList
            title={`Faturamento por ${profissionalSingular}`}
            data={data.porProfissional}
            color="bg-emerald-500"
          />
        </Card>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
          Distribuição por forma de pagamento
        </h3>

        <div className="flex flex-wrap gap-8">
          {Object.entries(data.porMetodo).map(([metodo, valor]) => (
            <div key={metodo} className="flex flex-col">
              <span className="text-xs text-muted-foreground">{metodo}</span>
              <span className="text-lg font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(valor)}
              </span>
            </div>
          ))}

          <PaymentMethodChart data={data.porMetodo} />
        </div>
      </div>
    </div>
  )
}

function FinancialSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  )
}