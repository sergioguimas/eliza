'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendWhatsappMessage } from './send-whatsapp'

export async function createAppointment(formData: FormData) {
  const supabase = await createClient()

  // 1. Pegar dados do formulário
  const customerId = formData.get('customerId') as string
  const serviceId = formData.get('serviceId') as string
  const startTimeRaw = formData.get('startTime') as string 

  if (!customerId || !serviceId || !startTimeRaw) {
    return { error: 'Preencha todos os campos' }
  }

  // 2. Pegar User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Usuário não autenticado' }
  }

  // 3. Pegar detalhes do serviço
  // CORREÇÃO: Usando os nomes certos do seu banco atual ('duration' e 'name')
  const { data: service } = await supabase
    .from('services')
    .select('duration, price, name') 
    .eq('id', serviceId)
    .single()

  if (!service) return { error: 'Procedimento não encontrado' }

  // 4. Calcular Horário
  const startTime = new Date(startTimeRaw)
  const endTime = new Date(startTime.getTime() + service.duration * 60000)

  // 5. Pegar Organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.organization_id) {
    return { error: 'Perfil sem organização vinculada' }
  }

  // Buscar dados do cliente (Nome e Telefone para o Zap)
  const { data: customer } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .single()

  if (!customer) return { error: 'Cliente não encontrado' }

  // 6. Salvar no Banco
  const { error } = await supabase.from('appointments').insert({
    client_id: customerId,
    service_id: serviceId,
    staff_id: user.id,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    price: service.price,
    status: 'confirmed',
    organization_id: profile.organization_id
  })

  if (error) {
    console.error("Erro ao agendar:", error)
    return { error: error.message }
  }

  // 7. Automação WhatsApp 🚀
  if (customer.phone) {
    try {
      const dia = startTime.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      const hora = startTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
      
      const message = `Olá ${customer.name}, seu agendamento de *${service.name}* foi confirmado para dia ${dia} às ${hora}.`
      
      await sendWhatsappMessage(customer.phone, message)
      console.log("✅ Mensagem automática enviada!")
      
    } catch (err) {
      console.error("Erro silencioso ao enviar zap:", err)
    }
  }

  revalidatePath('/agendamentos')
  revalidatePath('/') 
  return { success: true }
}