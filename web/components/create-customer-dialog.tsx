'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlus, Loader2, Phone, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { createCustomer } from "@/app/actions/create-customer"

type Props = {
  organizations_id: string
}

export function CreateCustomerDialog({ organizations_id }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    // O organizations_id é passado via Prop do Servidor para o Cliente e incluído no formulário
    formData.append('organizations_id', organizations_id)

    const result = await createCustomer(formData)

    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success("Paciente cadastrado com sucesso!")
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="mr-2 h-4 w-4" /> Novo Paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Paciente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Preencha os dados básicos para iniciar o prontuário.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input 
              id="full_name" 
              name="full_name" 
              placeholder="Ex: João da Silva" 
              required 
              className="bg-zinc-950 border-zinc-800" 
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input 
                id="phone" 
                name="phone" 
                placeholder="(11) 99999-9999" 
                className="bg-zinc-950 border-zinc-800 pl-9" 
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="document">CPF ou Documento</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <Input 
                id="document" 
                name="document" 
                placeholder="000.000.000-00" 
                className="bg-zinc-950 border-zinc-800 pl-9" 
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full mt-2">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Paciente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}