'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateCustomer } from "@/app/actions/update-customer"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// Definimos o tipo esperado dos dados
interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    gender?: string | null
    notes?: string | null
  }
}

export function EditCustomerDialog({ open, onOpenChange, customer }: EditCustomerDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const result = await updateCustomer(customer.id, formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Dados atualizados!")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Nome Completo</Label>
            <Input 
              id="edit-name" 
              name="name" 
              defaultValue={customer.name}
              required 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input 
                id="edit-email" 
                name="email" 
                type="email" 
                defaultValue={customer.email || ''}
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input 
                id="edit-phone" 
                name="phone" 
                defaultValue={customer.phone || ''}
                className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" 
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-gender">Gênero</Label>
            <Select name="gender" defaultValue={customer.gender || undefined}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-notes">Observações</Label>
            <Textarea 
              id="edit-notes" 
              name="notes" 
              defaultValue={customer.notes || ''}
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 resize-none h-20" 
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}