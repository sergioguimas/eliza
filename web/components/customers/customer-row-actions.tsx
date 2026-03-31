'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2, Copy, Loader2, Pencil, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deleteCustomer } from "@/app/actions/delete-customer"
import { UpdateCustomerDialog } from "./update-customer-dialog"
import { EstimateModal } from "./estimate-dialog"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

interface CustomerRowActionsProps {
  customer: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    gender?: string | null
    notes?: string | null
    organization_id: string
  }
    professionals: any[] 
    services: any[]
}

export function CustomerRowActions({ customer, professionals, services }: CustomerRowActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showEstimateDialog, setShowEstimateDialog] = useState(false)

  const organizationId = customer.organization_id

  const { dict } = useKeckleon()

  function handleCopyId() {
    navigator.clipboard.writeText(customer.id)
    toast.success("ID copiado")
  }

  async function handleDelete() {
    if (!confirm(`Excluir ${customer.name}?`)) return
    setLoading(true)
    const result = await deleteCustomer(customer.id)
    setLoading(false)
    if (result?.error) toast.error(result.error)
    else toast.success("Paciente removido")
  }

  return (
    <>
      <UpdateCustomerDialog 
        customer={customer} 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
      />

      <EstimateModal
        isOpen={showEstimateDialog}
        onClose={() => setShowEstimateDialog(false)}
        customerId={customer.id}
        organizationId={organizationId}
        professionals={professionals}
        services={services}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-foreground focus-visible:ring-0">
            <span className="sr-only">Abrir menu</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background border-border text-zinc-300">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>

          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault()
              setShowEditDialog(true)
            }} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4" />
            Editar Dados
          </DropdownMenuItem>

          <DropdownMenuItem 
            onSelect={(e) => {
              e.preventDefault()
              setShowEstimateDialog(true)
            }}
            className="text-primary focus:text-primary"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Criar Orçamento
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleCopyId} className="cursor-pointer focus:bg-zinc-800">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Copy className="mr-2 h-4 w-4" /> Copiar ID
            </Button>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-zinc-800" />
          
          <DropdownMenuItem onClick={handleDelete} className="text-red-500 focus:bg-red-950/30 focus:text-red-400 cursor-pointer">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}