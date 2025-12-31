'use client'

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteService } from "@/app/actions/create-service"
import { toast } from "sonner"

interface DeleteServiceButtonProps {
  serviceId: string
}

export function DeleteServiceButton({ serviceId }: DeleteServiceButtonProps) {
  async function handleDelete() {
    if (confirm("Tem certeza que deseja excluir este procedimento?")) {
      const result = await deleteService(serviceId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Procedimento excluído!")
      }
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-8 w-8 text-zinc-500 hover:text-red-500 transition-colors"
      onClick={handleDelete}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}