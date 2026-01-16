import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PrintButton } from "@/components/print-button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

export default async function PrintRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // Correção do Next.js 15+
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Busca na tabela NOVA (service_records)
  const { data: record } = await supabase
    .from('service_records')
    .select(`
      *,
      customer:customers(name, document, birth_date, address),
      professional:profiles!service_records_professional_id_fkey(full_name, role),
      organization:organizations(name)
    `)
    .eq('id', id)
    .single()

  if (!record) notFound()

  return (
    <div className="max-w-[210mm] mx-auto p-8 bg-white min-h-screen text-black print:p-0">
      <div className="flex justify-between items-start mb-8 print:hidden">
        <h1 className="text-xl font-bold text-gray-900">Visualização de Impressão</h1>
        <PrintButton />
      </div>

      {/* Cabeçalho */}
      <header className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{record.organization?.name}</h1>
        <div className="mt-2 text-sm text-gray-600">
          Registro de Atendimento #{record.id.slice(0, 8)}
        </div>
      </header>

      {/* Dados do Cliente */}
      <section className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
        <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">Dados do Cliente</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold">Nome:</span> {record.customer?.name}</div>
          <div><span className="font-semibold">Documento:</span> {record.customer?.document || 'N/A'}</div>
        </div>
      </section>

      {/* Conteúdo do Registro */}
      <main className="mb-12">
        <h2 className="text-sm font-bold uppercase text-gray-500 mb-2">
          Descrição do Atendimento ({format(new Date(record.created_at ?? new Date()), "dd/MM/yyyy", { locale: ptBR })})
        </h2>
        <div className="text-base leading-relaxed whitespace-pre-wrap border-l-4 border-gray-300 pl-4 py-2">
          {record.content}
        </div>
      </main>

      {/* Assinatura */}
      <footer className="mt-20 page-break-inside-avoid">
        <div className="flex flex-col items-center justify-center w-64 ml-auto">
          <div className="w-full border-t border-black mb-2"></div>
          <p className="font-bold text-sm">{record.professional?.full_name}</p>
          <p className="text-xs text-gray-500">{record.professional?.role || 'Profissional Responsável'}</p>
          {record.signed_at && (
             <p className="text-[10px] text-gray-400 mt-1">
               Assinado digitalmente em {format(new Date(record.signed_at), "dd/MM/yyyy 'às' HH:mm")}
             </p>
          )}
        </div>
      </footer>
    </div>
  )
}