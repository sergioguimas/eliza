'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UpdateCustomerDialog } from "@/components/customers/update-customer-dialog"
import { deleteCustomer } from "@/app/actions/delete-customer"
import { toast } from "sonner"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Printer,
} from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

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

export function CustomerDetailsHeader({
  customer,
}: CustomerDetailsHeaderProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const cliente = entities.cliente || "Cliente"
  const prontuario = entities.prontuario || "Histórico"

  async function handleDelete() {
    const confirmed = window.confirm(
      messages.delete_customer_confirm ||
        `Tem certeza que deseja excluir ${cliente.toLowerCase()} ${customer.name}?`
    )

    if (!confirmed) return

    setLoading(true)
    const result = await deleteCustomer(customer.id)

    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success(
        messages.customer_deleted_success ||
          `${cliente} excluído com sucesso.`
      )
      router.push("/clientes")
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="border-border text-zinc-400 hover:text-foreground hover:bg-background shrink-0"
          title={actions.back || "Voltar"}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            {customer.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400 mt-1">
            <span className="capitalize px-2 py-0.5 rounded-full bg-background border border-border text-xs">
              {customer.gender || messages.gender_not_informed || "Não informado"}
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
        <Button
          variant="outline"
          onClick={() => window.open(`/print/history/${customer.id}`, "_blank")}
          className="border-border text-zinc-300 hover:bg-background gap-2 hidden md:flex"
          title={messages.print_history_title || `Imprimir ${prontuario}`}
        >
          <Printer className="h-4 w-4" />
          <span className="hidden lg:inline">
            {messages.history_button_label || prontuario}
          </span>
        </Button>

        <UpdateCustomerDialog customer={customer}>
          <Button
            variant="outline"
            className="border-border text-zinc-300 hover:bg-background gap-2"
          >
            <Pencil className="h-4 w-4" />
            {actions.edit || "Editar"}
          </Button>
        </UpdateCustomerDialog>

        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={loading}
          className="bg-red-950/30 hover:bg-red-900/50 text-red-500 border border-red-900/30 gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {actions.delete || "Excluir"}
        </Button>
      </div>
    </div>
  )
}