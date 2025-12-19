'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  // 1. Pegar dados do formulário
  const customerId = formData.get('customerId') as string
  const serviceId = formData.get('serviceId') as string
  const startTimeRaw = formData.get('startTime') as string 

  if (!customerId || !serviceId || !startTimeRaw) {
    return { error: 'Preencha todos os campos' }
  }

  // 2. Pegar User (e garantir que existe)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Usuário não autenticado' }
  }

  // 3. Pegar detalhes do serviço
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, price')
    .eq('id', serviceId)
    .single()

  if (!service) return { error: 'Procedimento não encontrado' }

  // 4. Calcular Horário de Término
  const startTime = new Date(startTimeRaw)
  const endTime = new Date(startTime.getTime() + service.duration_minutes * 60000)

  // 5. Pegar Tenant (Segurança)
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id) // Agora seguro, pois checamos 'user' acima
    .single()

  // AQUI ESTAVA O ERRO: Precisamos garantir que o tenant_id existe
  if (!profile || !profile.tenant_id) {
    return { error: 'Perfil sem clínica vinculada' }
  }

  // 6. Salvar no Banco
  const { error } = await supabase.from('appointments').insert({
    customer_id: customerId,
    service_id: serviceId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    price: service.price,
    status: 'confirmed',
    tenant_id: profile.tenant_id // Agora o TypeScript sabe que é uma string válida
  })

  if (error) return { error: error.message }

  revalidatePath('/agendamentos')
  revalidatePath('/') 
  return { success: true }
}