'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

export function RealtimeAppointments() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Inscreve no canal de mudanças da tabela 'appointments'
    const channel = supabase
      .channel('realtime-appointments')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta tudo: UPDATE, INSERT, DELETE
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          console.log('⚡ Mudança detectada no banco:', payload)
          
          // O comando mágico: Recarrega os dados da página sem piscar a tela inteira
          router.refresh()

          // Feedback visual (opcional)
          if (payload.eventType === 'UPDATE' && payload.new.status === 'confirmed') {
             toast.success("Agendamento confirmado via WhatsApp!")
          }
        }
      )
      .subscribe()

    // Limpeza quando sair da página
    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase])

  return null // Este componente é invisível
}