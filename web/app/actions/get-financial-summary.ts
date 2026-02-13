'use server'

import { createClient } from "@/utils/supabase/server"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getFinancialSummary(organizationId: string, dateParam?: string) {
  const supabase = await createClient()
  const referenceDate = dateParam ? new Date(dateParam + "-01T03:00:00Z") : new Date()
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()

  const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`
  const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Buscar Agendamentos com detalhes de clientes e serviços
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, price, status, payment_status, payment_method, start_time, customers(name), services(title), professionals(name)')
    .eq('organization_id', organizationId)
    .gte('start_time', `${startOfMonthStr}T00:00:00Z`)
    .lte('start_time', `${endOfMonthStr}T23:59:59Z`)

  // Buscar Despesas Brutas
  const { data: exps } = await supabase
    .from('expenses')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('due_date', startOfMonthStr)
    .lte('due_date', endOfMonthStr)
    .order('due_date', { ascending: true })

  const metrics = {
    estimado: 0,
    recebido: 0,
    aPrazo: 0,
    porMetodo: {} as Record<string, number>,
    porProfissional: {} as Record<string, number>,
    porProcedimento: {} as Record<string, number>,
    despesasTotal: 0,
    listaDespesas: exps || [], // Lista bruta para o Modal
    listaRecebidos: [] as any[], // Lista bruta de entradas confirmadas
    listaPrazo: [] as any[] // Lista bruta de entradas a prazo
  }

  appts?.forEach(a => {
    const val = Number(a.price || 0)
    if (a.status !== 'canceled') {
  
      if (a.payment_status === 'paid') {
        metrics.recebido += val
        metrics.listaRecebidos.push(a) // Adiciona à lista de recebidos
        const method = a.payment_method || 'outro'
        metrics.porMetodo[method] = (metrics.porMetodo[method] || 0) + val
      } else {
        metrics.aPrazo += val 
        metrics.listaPrazo.push(a) // Adiciona à lista de a prazo
      }

      const prof = a.professionals?.name || 'outro'
      metrics.porProfissional[prof] = (metrics.porProfissional[prof] || 0) + val

      const serv = a.services?.title || 'outro'
      metrics.porProcedimento[serv] = (metrics.porProcedimento[serv] || 0) + val

    }
  });  

  exps?.forEach(e => {
    metrics.despesasTotal += Number(e.amount || 0)
  })

  return metrics
}