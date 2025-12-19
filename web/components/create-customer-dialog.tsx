'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createCustomer } from "@/app/actions/create-customer"
import { toast } from "sonner"
import { UserPlus } from "lucide-react"

export function CreateCustomerDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    const result = await createCustomer(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Paciente cadastrado com sucesso!")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Paciente
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Novo Paciente</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Preencha os dados básicos para o cadastro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid gap-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input id="name" name="name" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input id="phone" name="phone" className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gender">Gênero</Label>
            <Select name="gender">
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro / Prefiro não informar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Observações Iniciais</Label>
            <Textarea 
              id="notes" 
              name="notes" 
              placeholder="Histórico prévio, alergias, como conheceu a clínica..." 
              className="bg-zinc-950 border-zinc-800 focus:ring-blue-600 resize-none h-20" 
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
              {loading ? "Cadastrando..." : "Salvar Paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}