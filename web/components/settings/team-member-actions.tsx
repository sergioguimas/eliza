"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  removeTeamMember,
  updateTeamMemberRole,
} from "@/app/actions/team-members"

type MemberRole = "owner" | "admin" | "professional" | "staff"
type EditableRole = "admin" | "professional" | "staff"

type TeamMemberActionsProps = {
  memberId: string
  memberName: string
  memberRole: MemberRole
  currentUserRole: MemberRole
  isCurrentUser: boolean
  professionalLabel: string
}

export function TeamMemberActions({
  memberId,
  memberName,
  memberRole,
  currentUserRole,
  isCurrentUser,
  professionalLabel,
}: TeamMemberActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const canManage =
    currentUserRole === "owner" ||
    (currentUserRole === "admin" &&
      memberRole !== "owner" &&
      memberRole !== "admin")

  const canEditRole =
    canManage &&
    !isCurrentUser &&
    memberRole !== "owner"

  const canRemove =
    canManage &&
    !isCurrentUser &&
    memberRole !== "owner"

  function handleRoleChange(nextRole: EditableRole) {
    if (nextRole === memberRole) return

    const confirmed = window.confirm(
      `Deseja alterar a permissão de ${memberName} para ${getRoleLabel(
        nextRole,
        professionalLabel
      )}?`
    )

    if (!confirmed) return

    startTransition(async () => {
      const result = await updateTeamMemberRole(memberId, nextRole)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Permissão atualizada com sucesso.")
      router.refresh()
    })
  }

  function handleRemove() {
    const confirmed = window.confirm(
      `Deseja remover ${memberName} da equipe? Essa pessoa perderá o acesso à organização.`
    )

    if (!confirmed) return

    startTransition(async () => {
      const result = await removeTeamMember(memberId)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Membro removido com sucesso.")
      router.refresh()
    })
  }

  return (
    <div className="flex justify-end items-center gap-2">
      {canEditRole && (
        <select
          value={memberRole}
          disabled={isPending}
          onChange={(event) =>
            handleRoleChange(event.target.value as EditableRole)
          }
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {currentUserRole === "owner" && (
            <option value="admin">Administrador</option>
          )}
          <option value="professional">{professionalLabel}</option>
          <option value="staff">Staff / Recepção</option>
        </select>
      )}

      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleRemove}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Remover membro"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function getRoleLabel(role: EditableRole, professionalLabel: string) {
  switch (role) {
    case "admin":
      return "Administrador"
    case "professional":
      return professionalLabel
    default:
      return "Staff / Recepção"
  }
}