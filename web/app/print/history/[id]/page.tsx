"use client"

import { createClient } from "@/utils/supabase/client"
import { notFound } from "next/navigation"
import { useEffect, useState } from "react"

export default function PrintHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { id } = await params
      const supabase = createClient()
      
      // Buscando dados do cliente e da organização (antigo clinic/tenant)
      const { data: customerData } = await supabase
        .from('customers')
        .select(`
          *,
          organizations (
            name
          ),
          medical_records (
            id,
            content,
            created_at,
            status
          )
        `)
        .eq('id', id)
        .single()

      setData(customerData)
      setLoading(false)
    }
    loadData()
  }, [params])

  if (loading) return <div className="p-8 text-center text-zinc-500">Carregando histórico...</div>
  if (!data) return notFound()

  // @ts-ignore - Acessando o nome da organização de forma segura
  const organizationName = data.organizations?.name || "Eliza"

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen">
      {/* Cabeçalho de Impressão */}
      <header className="border-b-2 border-zinc-200 pb-6 mb-8 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-900">
          {organizationName}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Histórico Completo do Paciente</p>
      </header>

      {/* Identificação do Paciente */}
      <section className="mb-8 grid grid-cols-2 gap-4 text-sm border p-4 rounded-lg bg-zinc-50">
        <p><strong>Paciente:</strong> {data.name}</p>
        <p><strong>Telefone:</strong> {data.phone || '-'}</p>
        <p><strong>E-mail:</strong> {data.email || '-'}</p>
        <p><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
      </section>

      {/* Lista de Registros */}
      <div className="space-y-8">
        <h2 className="text-lg font-semibold border-b pb-2">Registros de Prontuário</h2>
        {data.medical_records?.length > 0 ? (
          data.medical_records.map((record: any) => (
            <div key={record.id} className="border-l-4 border-zinc-300 pl-4 py-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">
                  {new Date(record.created_at).toLocaleDateString('pt-BR')} às {new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] bg-zinc-100 px-2 py-1 rounded">ID: {record.id.split('-')[0]}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap text-zinc-800">
                {record.content}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-zinc-400 py-10">Nenhum registro encontrado no histórico.</p>
        )}
      </div>

      {/* Botão de Impressão (Oculto no papel) */}
      <div className="mt-12 flex justify-center no-print">
        <button 
          onClick={() => window.print()}
          className="bg-zinc-900 text-white px-8 py-2 rounded-lg font-medium hover:bg-zinc-800 transition-all"
        >
          Imprimir Histórico
        </button>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 2cm; }
        }
      `}</style>
    </div>
  )
}