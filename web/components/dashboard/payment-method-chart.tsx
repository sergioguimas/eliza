'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#94a3b8']

const labels: Record<string, string> = {
  pix: 'Pix',
  cartao_credito: 'C. Crédito',
  cartao_debito: 'C. Débito',
  dinheiro: 'Dinheiro',
  outro: 'Outro'
}

export function PaymentMethodChart({ data }: { data: Record<string, number> }) {
  // Transforma o objeto { pix: 100 } em array para o Recharts [{ name: 'Pix', value: 100 }]
  const chartData = Object.entries(data).map(([key, value]) => ({
    name: labels[key] || key,
    value: value
  })).filter(item => item.value > 0)

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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any) => `R$ ${value.toFixed(2)}`}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}