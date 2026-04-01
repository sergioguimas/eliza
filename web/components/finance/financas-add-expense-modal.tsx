'use client'

import { useState } from "react"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { createExpense } from "@/app/actions/create-expense"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

export function AddExpenseModal({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}
  const fields = dict.fields || {}

  const expense = entities.expense || "Despesa"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)

    const formData = new FormData(event.currentTarget)
    formData.append('organization_id', organizationId)

    const result = await createExpense(formData)

    if (result.success) {
      toast.success(messages.expense_created_success || `${expense} registrada!`)
      setOpen(false)
    } else {
      toast.error(result.error || messages.generic_error || "Erro ao salvar.")
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          {actions.create_expense || `Lançar ${expense}`}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-content border-border bg-card">
        <DialogHeader>
          <DialogTitle>
            {messages.new_expense_title || `Nova ${expense}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="description">
              {fields.description || "Descrição"}
            </Label>
            <Input
              id="description"
              name="description"
              placeholder={
                messages.expense_description_placeholder ||
                "Ex: Aluguel, Luz, Fornecedor..."
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                {fields.amount || "Valor"} (R$)
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">
                {fields.due_date || "Vencimento"}
              </Label>
              <Input id="due_date" name="due_date" type="date" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              {fields.status || "Status Inicial"}
            </Label>

            <Select name="status" defaultValue="pending">
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    messages.select_status || "Selecione o status"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="pending">
                  {messages.status_pending || "A pagar (Pendente)"}
                </SelectItem>
                <SelectItem value="paid">
                  {messages.status_paid || "Pago (Efetivado)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              actions.save_expense || `Salvar ${expense}`
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}