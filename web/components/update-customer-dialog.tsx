'use client'

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Loader2 } from "lucide-react"
import { useState, useTransition } from "react"
import { updateCustomer } from "@/app/actions/update-customer"
import { toast } from "sonner"

export function UpdateCustomerDialog({ customer, open: controlledOpen, onOpenChange }: { 
  customer: any, 
  open?: boolean, 
  onOpenChange?: (open: boolean) => void 
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  // Gerencia se o modal é controlado por fora (props) ou internamente (state)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  const [isActive, setIsActive] = useState(customer.active !== false)

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      // O ID já está num input hidden dentro do form, então o formData já o contém.
      // A ação agora espera APENAS o formData.
      const result = await updateCustomer(formData)
      
      if (result.success) {
        toast.success("Dados atualizados com sucesso!")
        setOpen(false)
      } else {
        toast.error("Erro ao atualizar dados.")
      }
    })
  }

  const birthDateValue = customer.birth_date ? new Date(customer.birth_date).toISOString().split('T')[0] : ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Só mostra o Trigger se não for controlado externamente */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize as informações cadastrais e preferências.
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit} className="space-y-4 py-4">
          <input type="hidden" name="id" value={customer.id} />
          
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
                <Label className="text-base">Cadastro Ativo</Label>
                <p className="text-xs text-muted-foreground">Desative para ocultar de novos agendamentos.</p>
            </div>
            <Switch 
                name="active" 
                checked={isActive} 
                onCheckedChange={setIsActive} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" name="name" defaultValue={customer.name} required />
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" name="phone" defaultValue={customer.phone} required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input id="birth_date" name="birth_date" type="date" defaultValue={birthDateValue} />
            </div>

            <div className="space-y-2 col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={customer.email} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="document">CPF</Label>
                <Input id="document" name="document" defaultValue={customer.document} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço Completo</Label>
            <Textarea id="address" name="address" defaultValue={customer.address} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações Internas</Label>
            <Textarea id="notes" name="notes" defaultValue={customer.notes} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}