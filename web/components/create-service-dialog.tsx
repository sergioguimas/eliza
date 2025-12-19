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
import { createService } from "@/app/actions/create-service"
import { toast } from "sonner"
import { Plus, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue (Padrão)
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
]

export function CreateServiceDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedColor, setSelectedColor] = useState('#3b82f6')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    
    const formData = new FormData(event.currentTarget)
    formData.append('color', selectedColor) // Adiciona a cor escolhida

    const result = await createService(formData)

    setLoading(false)

    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success("Procedimento cadastrado com sucesso!")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          Novo Procedimento
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Procedimento</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Defina o nome, valor e a cor de identificação na agenda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Nome do Procedimento</Label>
            <Input id="title" name="title" placeholder="Ex: Consulta Rotina" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
          </div>
          
          <div className="grid gap-2">
            <Label>Cor na Agenda</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all",
                    selectedColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && <Check className="h-4 w-4 text-white drop-shadow-md" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Valor (R$)</Label>
              <Input id="price" name="price" type="number" step="0.01" placeholder="0.00" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duration">Duração (min)</Label>
              <Input id="duration" name="duration" type="number" placeholder="30" defaultValue="30" required className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
              {loading ? "Salvando..." : "Salvar Cadastro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}