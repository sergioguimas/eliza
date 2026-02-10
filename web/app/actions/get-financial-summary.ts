'use server'

import { createClient } from "@/utils/supabase/server"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getFinancialSummary(organizationId: string) {
  const supabase = await createClient()
  const start = startOfMonth(new Date()).toISOString()
  const end = endOfMonth(new Date()).toISOString()

  // Buscar Agendamentos com detalhes de clientes e serviços
  const { data: appts } = await supabase
    .from('appointments')
    .select('price, status, payment_status, payment_method, start_time, customers(name), services(title), professionals(name)')
    .eq('organization_id', organizationId)
    .gte('start_time', start)
    .lte('start_time', end)

  // Buscar Despesas Brutas
  const { data: exps } = await supabase
    .from('expenses')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('due_date', start.split('T')[0])
    .lte('due_date', end.split('T')[0])
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
    listaRecebidos: [] as any[] // Lista bruta de entradas confirmadas
  }

  appts?.forEach(a => {
    const val = Number(a.price || 0)
    if (a.status !== 'canceled') metrics.estimado += val
    
    if (a.payment_status === 'paid') {
      metrics.recebido += val
      metrics.listaRecebidos.push(a)
      const metodo = a.payment_method || 'Não Informado'
      metrics.porMetodo[metodo] = (metrics.porMetodo[metodo] || 0) + val
    } else if (a.status === 'confirmed' || a.status === 'completed') {
      metrics.aPrazo += val
    }

    const prof = a.professionals?.name || 'Outros'
    metrics.porProfissional[prof] = (metrics.porProfissional[prof] || 0) + val

    const serv = a.services?.title || 'Outros'
    metrics.porProcedimento[serv] = (metrics.porProcedimento[serv] || 0) + val
  })

  exps?.forEach(e => {
    metrics.despesasTotal += Number(e.amount || 0)
  })

  return metrics
}