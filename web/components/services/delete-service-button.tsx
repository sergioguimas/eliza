'use client'

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteService } from "@/app/actions/create-service"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

interface DeleteServiceButtonProps {
  serviceId: string
}

export function DeleteServiceButton({ serviceId }: DeleteServiceButtonProps) {
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const servico = entities.servico || "Procedimento"

  async function handleDelete() {
    const confirmMessage =
      messages.confirm_delete_servico ||
      `Tem certeza que deseja excluir este ${servico.toLowerCase()}?`

    if (confirm(confirmMessage)) {
      const result = await deleteService(serviceId)

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(
          messages.deleted_success ||
            `${servico} excluído com sucesso.`
        )
      }
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-zinc-500 hover:text-red-500 transition-colors"
      onClick={handleDelete}
      title={actions.delete || "Excluir"}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}