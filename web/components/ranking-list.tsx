interface RankingListProps {
  title: string
  data: Record<string, number>
  color?: string
}

export function RankingList({ title, data, color = "bg-blue-500" }: RankingListProps) {
  // Ordena do maior faturamento para o menor
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a)
  const maxVal = sorted[0]?.[1] || 1

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-4">
        {sorted.length > 0 ? (
          sorted.map(([name, value]) => (
            <div key={name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate max-w-[200px]">{name}</span>
                <span className="font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                </span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full ${color} transition-all duration-500`} 
                  style={{ width: `${(value / maxVal) * 100}%` }} 
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic">Nenhum dado registrado.</p>
        )}
      </div>
    </div>
  )
}