import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PrintButton } from "@/components/print-button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database } from "@/utils/database.types"

export const dynamic = 'force-dynamic'

export default async function PrintHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient<Database>()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Busca Cliente e Organização
  const { data: customer } = await supabase
    .from('customers')
    .select('*, organization:organizations(name)')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  // Busca TODOS os registros
  const { data: records, error } = await (supabase.from('service_records'))
    .select(`
      id,
      content,
      created_at,
      status,
      signed_at,
      signed_by,
      signature_hash,
      professional:profiles!service_records_professional_id_fkey ( full_name, role )
    `)
    .eq('customer_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error("Erro ao buscar histórico para impressão:", error)
  }

  return (
    <div className="max-w-[210mm] mx-auto p-10 bg-white min-h-screen text-black print:p-0">
      <div className="flex justify-between items-start mb-8 print:hidden">
        <div>
           <h1 className="text-lg font-bold">Histórico Completo</h1>
           <p className="text-sm text-gray-500">Visualização de impressão</p>
        </div>
        <PrintButton />
      </div>

      {/* CABEÇALHO DA PÁGINA */}
      <header className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{customer.organization?.name}</h1>
        <div className="flex justify-between mt-4">
           <div>
              <p className="text-sm">Paciente/Cliente: <span className="font-bold">{customer.name}</span></p>
              <p className="text-sm">Documento: {customer.document || 'N/A'}</p>
           </div>
           <div className="text-right">
              <p className="text-sm">Data de Emissão: {format(new Date(), "dd/MM/yyyy")}</p>
           </div>
        </div>
      </header>

      {/* LISTA DE REGISTROS */}
      <main className="space-y-8">
        {records?.map((rec: any) => (
          <div key={rec.id} className="avoid-break-inside">
             <div className="flex items-center gap-2 mb-2 bg-gray-100 p-2 rounded-sm print:bg-transparent print:border-b print:border-gray-300 print:rounded-none">
                <span className="font-bold text-sm">
                   {format(new Date(rec.created_at), "dd/MM/yyyy")}
                </span>
                <span className="text-xs text-gray-600">
                   às {format(new Date(rec.created_at), "HH:mm")}
                </span>
                <span className="text-xs text-gray-600 ml-auto">
                   Profissional: {rec.professional?.full_name}
                </span>
             </div>
             
             <div className="text-sm text-justify leading-relaxed px-2 whitespace-pre-wrap">
                {rec.content}
             </div>

             {rec.status === 'signed' && (
                <div className="text-center">
                <p className="font-bold text-sm uppercase">{rec.professional?.full_name}</p>
                <p className="text-xs text-gray-600 mb-2">{rec.professional?.role === 'owner' ? 'Responsável Técnico' : 'Profissional'}</p>
                
                <div className="bg-gray-100 p-2 inline-block rounded border border-gray-200 mt-2">
                    <p className="text-[10px] text-gray-500 font-mono">
                        Assinado digitalmente em {format(new Date(rec.signed_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono tracking-tighter">
                        HASH: {rec.signature_hash}
                    </p>
                </div>
             </div>
             )}
          </div>
        ))}
      </main>

      <footer className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
         <p className="text-[10px] text-gray-400 text-center mt-8">
            Documento gerado pelo sistema Eliza em {format(new Date(), "dd/MM/yyyy HH:mm")}
         </p>
      </footer>
    </div>
  )
}