'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type Tables } from '@/lib/database.types'
import { Activity, Users, Calendar } from 'lucide-react'

export default function Home() {
  const supabase = createClient()
  const [services, setServices] = useState<Tables<'services'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchServices() {
      const { data } = await supabase.from('services').select('*')
      setServices(data || [])
      setLoading(false)
    }
    fetchServices()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-zinc-100">Visão Geral</h1>
      
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Procedimentos Ativos</p>
              <h3 className="text-2xl font-bold text-zinc-100">
                {loading ? '...' : services.length}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Pacientes Cadastrados</p>
              <h3 className="text-2xl font-bold text-zinc-100">0</h3> {/* Vamos conectar depois */}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Agendamentos Hoje</p>
              <h3 className="text-2xl font-bold text-zinc-100">0</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}