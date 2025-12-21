'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { EditCustomerDialog } from "@/components/edit-customer-dialog"
import { deleteCustomer } from "@/app/actions/delete-customer"
import { toast } from "sonner"
import { ArrowLeft, Pencil, Trash2, Loader2, Phone, Mail } from "lucide-react"

interface CustomerDetailsHeaderProps {
  customer: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    gender?: string | null
    notes?: string | null
  }
}

export function CustomerDetailsHeader({ customer }: CustomerDetailsHeaderProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja excluir o paciente ${customer.name}?`)) return
    
    setLoading(true)
    const result = await deleteCustomer(customer.id)
    
    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success("Paciente excluído com sucesso")
      router.push("/clientes") // Redireciona para a lista
    }
  }

  return (
    <>
      {/* O Modal de Edição fica aqui, invisível até ser chamado */}
      <EditCustomerDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
        customer={customer} 
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.back()} 
            className="border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 flex items-center gap-3">
              {customer.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400 mt-1">
              <span className="capitalize px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
                {customer.gender || 'Gênero n/d'}
              </span>
              
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {customer.phone}
                </span>
              )}
              
              {customer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {customer.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Botão EDITAR */}
          <Button 
            variant="outline" 
            onClick={() => setShowEditDialog(true)}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 gap-2"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>

          {/* Botão EXCLUIR */}
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-950/30 hover:bg-red-900/50 text-red-500 border border-red-900/30 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir
          </Button>
        </div>
      </div>
    </>
  )
}