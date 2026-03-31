

export function ProcedureRanking({ data }: { data: Record<string, number> }) {
  // Converte o objeto em array e ordena do maior para o menor
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a)
  const maxVal = sorted[0]?.[1] || 1

  return (
    <div className="space-y-6">
      {sorted.map(([name, value]) => (
        <div key={name} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{name}</span>
            <span className="text-muted-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
            </span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all" 
              style={{ width: `${(value / maxVal) * 100}%` }} 
            />
          </div>
        </div>
      ))}
    </div>
  )
}