// web/components/create-service-dialog.tsx
'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Palette } from "lucide-react"
import { upsertService } from "@/app/actions/create-service"
import { toast } from "sonner"

const COLORS = [
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Verde', value: '#10b981' },
  { name: 'Roxo', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Laranja', value: '#f59e0b' },
  { name: 'Vermelho', value: '#ef4444' },
]

export function CreateServiceDialog({ organizations_id, serviceToEdit }: { organizations_id: string, serviceToEdit?: any }) {
  const [open, setOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState(serviceToEdit?.color || COLORS[0].value)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.append('color', selectedColor)
    if (serviceToEdit) formData.append('id', serviceToEdit.id)

    const result = await upsertService(formData)
    if (result.error) toast.error(result.error)
    else {
      toast.success(serviceToEdit ? "Atualizado!" : "Criado!")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {serviceToEdit ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="mr-2 h-4 w-4" /> Novo Procedimento</Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader><DialogTitle>{serviceToEdit ? 'Editar' : 'Novo'} Procedimento</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" defaultValue={serviceToEdit?.name} required className="bg-zinc-950 border-zinc-800" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Duração (min)</Label><Input name="duration" type="number" defaultValue={serviceToEdit?.duration} className="bg-zinc-950 border-zinc-800" /></div>
            <div><Label>Preço (R$)</Label><Input name="price" type="number" step="0.01" defaultValue={serviceToEdit?.price} className="bg-zinc-950 border-zinc-800" /></div>
          </div>
          <div>
            <Label className="flex items-center gap-2 mb-2"><Palette className="h-4 w-4" /> Cor na Agenda</Label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${selectedColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}