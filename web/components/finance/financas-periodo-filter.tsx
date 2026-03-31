'use client'

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export function PeriodoFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Pega o mês atual da URL ou gera o padrão (YYYY-MM)
  const currentPeriod = searchParams.get("periodo") || format(new Date(), "yyyy-MM")

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set("periodo", value)
    router.push(`?${params.toString()}`)
  }

  // Gera os últimos 6 meses e os próximos 3 para previsão
  const months = Array.from({ length: 10 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - 6 + i)
    return {
      label: format(date, "MMMM yyyy", { locale: ptBR }),
      value: format(date, "yyyy-MM")
    }
  })

  return (
    <Select value={currentPeriod} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px] bg-card">
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value} className="capitalize">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}