import { createClient } from "@/utils/supabase/server"
import { notFound, redirect } from "next/navigation"
import { PrintButton } from "@/components/print-button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database } from "@/utils/database.types"

// Cache Busting (Garante dados frescos)
export const dynamic = 'force-dynamic'

export default async function PrintRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient<Database>()

  // 1. Autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // 2. Busca o REGISTRO ÚNICO (com dados do cliente e profissional)
  const { data: record } = await (supabase.from('service_records') as any)
    .select(`
      *,
      customer:customers ( name, document, organization:organizations(name) ),
      professional:profiles!service_records_professional_id_fkey ( full_name, role )
    `)
    .eq('id', id)
    .single()

  if (!record) notFound()

  // 3. Renderização
  return (
    <div className="max-w-[210mm] mx-auto p-10 bg-white min-h-screen text-black print:p-0">
      
      {/* Botão Flutuante (Some na impressão) */}
      <div className="flex justify-between items-start mb-8 print:hidden">
        <div>
           <h1 className="text-lg font-bold">Registro Individual</h1>
           <p className="text-sm text-gray-500">Visualização de impressão</p>
        </div>
        <PrintButton />
      </div>

      {/* CABEÇALHO */}
      <header className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wide">
            {record.customer?.organization?.name || "Registro Clínico"}
        </h1>
        <div className="flex justify-between mt-4">
           <div>
              <p className="text-sm">Paciente: <span className="font-bold">{record.customer?.name}</span></p>
              <p className="text-sm">Data do Atendimento: {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
           </div>
           <div className="text-right">
              <p className="text-sm text-gray-500">ID: {record.id.slice(0, 8)}</p>
           </div>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="py-4 min-h-[300px]">
         <div className="text-sm text-justify leading-relaxed whitespace-pre-wrap font-serif">
            {record.content}
         </div>
      </main>

      {/* RODAPÉ / ASSINATURA */}
      <footer className="mt-12 pt-4 border-t border-gray-300">
         {record.status === 'signed' ? (
             <div className="text-center">
                <p className="font-bold text-sm uppercase">{record.professional?.full_name}</p>
                <p className="text-xs text-gray-600 mb-2">{record.professional?.role === 'owner' ? 'Responsável Técnico' : 'Profissional'}</p>
                
                <div className="bg-gray-100 p-2 inline-block rounded border border-gray-200 mt-2">
                    <p className="text-[10px] text-gray-500 font-mono">
                        Assinado digitalmente em {format(new Date(record.signed_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono tracking-tighter">
                        HASH: {record.signature_hash}
                    </p>
                </div>
             </div>
         ) : (
             <div className="text-center pt-8">
                <div className="border-t border-black w-64 mx-auto mb-2"></div>
                <p className="text-sm">{record.professional?.full_name}</p>
                <p className="text-xs text-gray-500">(Rascunho não assinado)</p>
             </div>
         )}

         <p className="text-[10px] text-gray-400 text-center mt-8">
            Documento gerado pelo sistema Eliza em {format(new Date(), "dd/MM/yyyy HH:mm")}
         </p>
      </footer>
    </div>
  )
}