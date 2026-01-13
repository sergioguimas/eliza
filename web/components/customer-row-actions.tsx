'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2, FileText, Copy, Loader2, Pencil } from "lucide-react"
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
  }
}

export function CustomerRowActions({ customer }: CustomerRowActionsProps) {
  const [loading, setLoading] = useState(false)
  
  const [showEditDialog, setShowEditDialog] = useState(false)
  
  const router = useRouter()

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
      <UpdateCustomerDialog customer={customer}>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Editar Dados
        </Button>
      </UpdateCustomerDialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-foreground focus-visible:ring-0">
            <span className="sr-only">Abrir menu</span>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background border-border text-zinc-300">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => router.push(`/clientes/${customer.id}`)} className="cursor-pointer focus:bg-zinc-800">
            <FileText className="mr-2 h-4 w-4" /> Ver {dict.label_prontuario}
          </DropdownMenuItem>

          {/* 3. O BOTÃO QUE ABRE O MODAL */}
          <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="cursor-pointer focus:bg-zinc-800">
            <Pencil className="mr-2 h-4 w-4" /> Editar Dados
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleCopyId} className="cursor-pointer focus:bg-zinc-800">
            <Copy className="mr-2 h-4 w-4" /> Copiar ID
          </DropdownMenuItem>
          
          <DropdownMenuSeparator className="bg-zinc-800" />
          
          <DropdownMenuItem onClick={handleDelete} className="text-red-500 focus:bg-red-950/30 focus:text-red-400 cursor-pointer">
            <Trash2 className="mr-2 h-4 w-4" /> Excluir {dict.label_paciente}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}