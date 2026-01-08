import { createClient } from "@/utils/supabase/server"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function PrintRecordPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = await params
  const id = resolvedParams.id
  const supabase = await createClient()

  // 1. Busca segura do registro
  const { data: record } = await supabase
    .from('medical_records')
    .select(`
      *,
      customers (name),
      professional:profiles!professional_id (
        full_name,
        organization_id
      )
    `)
    .eq('id', id)
    .single()

  if (!record) return <div className="p-10 text-center">Registro não encontrado.</div>

  // 2. Busca dados da organização
  // CORREÇÃO 1: Adicionamos '|| ""' para garantir que nunca passamos undefined para o .eq()
  const orgId = record.professional?.organization_id || ""
  
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId) 
    .single()

  // CORREÇÃO 2: Fallback para data caso venha nula (evita erro no new Date)
  const dataAtendimento = record.created_at 
    ? format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : "--/--/----"

  return (
    <div className="p-12 max-w-[800px] mx-auto font-sans text-black bg-white min-h-screen">
      
      {/* Cabeçalho */}
      <div className="text-center border-b-2 border-gray-800 pb-6 mb-8">
        <h1 className="text-2xl font-bold uppercase tracking-wider">{org?.name || "Clínica MedAgenda"}</h1>
        <p className="text-sm text-gray-600 mt-1">{org?.address}</p>
        <p className="text-sm text-gray-600">{org?.phone}</p>
      </div>
      
      {/* Dados do Cliente */}
      <div className="mb-8 bg-gray-50 p-4 rounded border border-gray-200">
        <p className="mb-1"><strong className="text-gray-700">Cliente:</strong> {record.customers?.name || "Não identificado"}</p>
        <p><strong className="text-gray-700">Data do Atendimento:</strong> {dataAtendimento}</p>
      </div>

      {/* Título */}
      <h2 className="text-lg font-bold mb-4 border-l-4 border-gray-800 pl-3 uppercase">Relatório de Atendimento</h2>

      {/* Conteúdo */}
      <div className="text-justify whitespace-pre-wrap leading-relaxed text-gray-800 mb-12 min-h-[200px]">
        {record.content || "Sem anotações."}
      </div>

      {/* Assinatura */}
      <div className="mt-20 border-t border-gray-400 pt-4 text-center w-64 mx-auto break-inside-avoid page-break-inside-avoid">
        <p className="font-bold text-gray-900">{record.professional?.full_name || "Profissional Responsável"}</p>
        <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Responsável Técnico</p>
        {/* CORREÇÃO 3: Proteção caso o ID venha undefined (raro, mas possível em tipos) */}
        <p className="text-[10px] text-gray-400 mt-2 font-mono">ID: {record.id?.slice(0, 8) || "---"}</p>
      </div>

      <style>{`
        @media print {
          @page { margin: 2cm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <script dangerouslySetInnerHTML={{__html: 'window.print()'}} />
    </div>
  )
}