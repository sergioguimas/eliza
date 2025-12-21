'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash2, FileText, Copy, Loader2 } from "lucide-react"
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
import { toast } from "sonner"

interface CustomerRowActionsProps {
  customer: {
    id: string
    name: string
  }
}

export function CustomerRowActions({ customer }: CustomerRowActionsProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function handleCopyId() {
    navigator.clipboard.writeText(customer.id)
    toast.success("ID copiado para a área de transferência")
  }

  async function handleDelete() {
    if (!confirm(`Tem certeza que deseja excluir o paciente ${customer.name}? Essa ação não pode ser desfeita.`)) return

    setLoading(true)
    const result = await deleteCustomer(customer.id)
    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Paciente removido com sucesso")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-100 focus-visible:ring-0">
          <span className="sr-only">Abrir menu</span>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-300">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        
        <DropdownMenuItem 
          onClick={() => router.push(`/clientes/${customer.id}`)}
          className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" /> Ver Prontuário
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleCopyId} className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer">
          <Copy className="mr-2 h-4 w-4" /> Copiar ID
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-zinc-800" />
        
        <DropdownMenuItem 
          onClick={handleDelete} 
          className="text-red-500 focus:bg-red-950/30 focus:text-red-400 cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Excluir Paciente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}