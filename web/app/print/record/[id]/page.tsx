"use client"

import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function PrintRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Buscando o prontuário com os novos nomes de coluna
  const { data: record } = await supabase
    .from('medical_records')
    .select(`
      *,
      customers (
        name,
        email,
        phone,
        gender
      ),
      profiles!medical_records_staff_id_fkey (
        name
      )
    `)
    .eq('id', id)
    .single()

  if (!record) {
    return notFound()
  }

  // Agora usamos staff_id e a relação correta com profiles
  // @ts-ignore
  const professionalName = record.profiles?.name || "Profissional Responsável"

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen">
      {/* Cabeçalho de Impressão (Eliza) */}
      <div className="flex justify-between items-start border-b-2 border-zinc-200 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Eliza - Prontuário Digital</h1>
          <p className="text-zinc-500 text-sm">Registro gerado via sistema de gestão integrada</p>
        </div>
        <div className="text-right text-sm">
          <p><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
          <p><strong>ID do Registro:</strong> {record.id.split('-')[0].toUpperCase()}</p>
        </div>
      </div>

      {/* Dados do Paciente */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold bg-zinc-100 p-2 mb-4">Dados do Paciente</h2>
        <div className="grid grid-cols-2 gap-4">
          <p><strong>Nome:</strong> {record.customers?.name}</p>
          <p><strong>Gênero:</strong> {record.customers?.gender || '-'}</p>
          <p><strong>Telefone:</strong> {record.customers?.phone || '-'}</p>
          <p><strong>E-mail:</strong> {record.customers?.email || '-'}</p>
        </div>
      </section>

      {/* Conteúdo do Prontuário */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold bg-zinc-100 p-2 mb-4">Evolução / Relato</h2>
        <div className="whitespace-pre-wrap border p-4 rounded-md min-h-[300px] border-zinc-200">
          {record.content}
        </div>
      </section>

      {/* Rodapé e Assinatura */}
      <footer className="mt-16 pt-8 border-t border-dashed border-zinc-300">
        <div className="flex flex-col items-center justify-center">
          <div className="w-64 border-b border-black mb-2"></div>
          <p className="font-bold">{professionalName}</p>
          <p className="text-sm text-zinc-500">Responsável Técnico</p>
          
          {record.signed_at && (
            <div className="mt-4 p-2 bg-green-50 border border-green-200 text-green-800 text-xs rounded">
              Documento assinado digitalmente em {format(new Date(record.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </div>
      </footer>

      {/* Botão de Impressão (Não aparece no papel) */}
      <div className="mt-8 no-print flex justify-center">
        <button 
          onClick={() => window.print()}
          className="bg-zinc-900 text-white px-6 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Imprimir Agora
        </button>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}