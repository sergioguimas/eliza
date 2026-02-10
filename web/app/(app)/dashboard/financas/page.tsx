import { Suspense } from "react"
import { getFinancialSummary } from "@/app/actions/get-financial-summary"
import { FinancialCards } from "@/components/financial-cards"
import { Skeleton } from "@/components/ui/skeleton"
import { ProcedureRanking } from "@/components/procedure-ranking"
import { RankingList } from "@/components/ranking-list"
import { Card } from "@/components/ui/card"
import { AddExpenseModal } from "@/components/financas-add-expense-modal"

// Pegamos o ID da organização (exemplo via busca ou contexto de auth)
const ORGANIZATION_ID = "SEU_ID_AQUI" 

export default async function FinancasPage() {
  const data = await getFinancialSummary(ORGANIZATION_ID)

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      {/* Título e Cards de KPI que já fizemos */}
    <h2 className="text-3xl font-bold tracking-tight">Painel Financeiro</h2>
    <FinancialCards data={data} />
    <div className="flex items-center justify-between space-y-2">
        <div>
            <p className="text-muted-foreground">Gestão de entradas e saídas.</p>
        </div>
        <div className="flex items-center gap-2">
            <AddExpenseModal organizationId={ORGANIZATION_ID} />
        </div>
    </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Bloco 1: Faturamento por Procedimento */}
            <Card className="p-6 border-border/50 shadow-sm">
                <RankingList 
                title="Faturamento por Procedimento" 
                data={data.porProcedimento} 
                color="bg-indigo-500" 
                />
            </Card>

            {/* Bloco 2: Faturamento por Profissional */}
            <Card className="p-6 border-border/50 shadow-sm">
                <RankingList 
                title="Faturamento por Profissional" 
                data={data.porProfissional} 
                color="bg-emerald-500" 
                />
            </Card>
            </div>
            
            {/* Bloco de Formas de Pagamento (Compacto) */}
            <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">
                Distribuição por Forma de Pagamento
            </h3>
            <div className="flex flex-wrap gap-8">
                {Object.entries(data.porMetodo).map(([metodo, valor]) => (
                    <div key={metodo} className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{metodo}</span>
                    <span className="text-lg font-bold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
                    </span>
                    </div>
                ))}
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