'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type Tables } from '@/lib/database.types'

export default function Home() {
  const supabase = createClient()
  const [services, setServices] = useState<Tables<'services'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchServices() {
      // Tenta buscar dados da tabela 'services'
      const { data, error } = await supabase.from('services').select('*')
      
      if (error) {
        setError(error.message)
        console.error('Erro Supabase:', error)
      } else {
        setServices(data || [])
      }
      setLoading(false)
    }

    fetchServices()
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-950 text-white font-sans">
      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center text-emerald-400">
          SaaS Agendamento
        </h1>
        
        <div className="border border-zinc-800 p-6 rounded-lg bg-zinc-900 shadow-xl">
          <h2 className="text-xl mb-4 font-semibold border-b border-zinc-700 pb-2">Status da Conexão:</h2>
          
          {loading && <p className="text-yellow-500 animate-pulse">📡 Conectando ao Supabase...</p>}
          
          {error && (
            <div className="text-red-400 p-4 bg-red-950/30 rounded border border-red-900">
              ❌ Erro: {error}
              <p className="text-xs mt-2 text-red-300">Verifique se o Supabase local está rodando (npx supabase start).</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-4">
              <p className="text-green-400 font-medium flex items-center gap-2">
                ✅ Conexão estabelecida com sucesso!
              </p>
              <div className="bg-zinc-950 p-4 rounded text-zinc-400">
                <p>Serviços encontrados no banco: <span className="font-bold text-white">{services.length}</span></p>
                {services.length === 0 && (
                  <p className="text-xs text-zinc-500 mt-2 italic">
                    (O banco está vazio, o que é esperado. O importante é que não deu erro de conexão.)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}