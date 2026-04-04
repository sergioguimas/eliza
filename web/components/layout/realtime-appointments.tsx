'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export function RealtimeAppointments() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    console.log("🔌 [Realtime] Iniciando conexão...")

    const channel = supabase
      .channel('global-appointments-listener')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          // Só atualiza a tela se o status realmente mudou de valor
          if (payload.new.status !== payload.old.status) {
            console.log('🔄 [Realtime] Status sincronizado. Atualizando visual...')
            router.refresh()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Conectado e escutando!')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase])

  return null
}