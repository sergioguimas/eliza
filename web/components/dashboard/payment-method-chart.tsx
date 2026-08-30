'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useKeckleon } from '@/providers/keckleon-provider'

// Paleta categórica: as fatias só precisam ser distinguíveis entre si — o rótulo
// da legenda é que diz qual é a forma de pagamento. Vem dos tokens já aprovados
// em vez de hex fixo; o segundo item era o indigo do template shadcn, o mesmo
// que esta refatoracao removeu do resto do produto.
//
// As utilitárias `fill-*` vencem o atributo de apresentação que o recharts
// escreve, então a fatia acompanha o tema sem resolver cor em JS.
//
// Stopgap: uma paleta categórica própria ainda não existe neste projeto.
const SLICE_CLASSES = [
  'fill-success',
  'fill-info',
  'fill-warning',
  'fill-danger',
  'fill-muted-foreground',
]

export function PaymentMethodChart({ data }: { data: Record<string, number> }) {
  const { dict } = useKeckleon()

  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const labels: Record<string, string> = {
    pix: actions.pix || 'Pix',
    cartao_credito: actions.credit_card || 'Cartão de crédito',
    cartao_debito: actions.debit_card || 'Cartão de débito',
    dinheiro: actions.cash || 'Dinheiro',
    outro: actions.other || 'Outro',
  }

  const chartData = Object.entries(data)
    .map(([key, value]) => ({
      name: labels[key] || key,
      value,
    }))
    .filter((item) => item.value > 0)

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center text-sm text-muted-foreground">
        {messages.no_data || 'Nenhum dado registrado.'}
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} className={SLICE_CLASSES[index % SLICE_CLASSES.length]} />
            ))}
          </Pie>

          <Tooltip
            formatter={(value) => {
              const numericValue =
                typeof value === 'number'
                  ? value
                  : Number(value ?? 0)

              return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(numericValue)
            }}
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />

          <Legend formatter={(value) => (
            <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
          )} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}