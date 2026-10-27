'use client'

import { useState } from "react"
import { Ban } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { reabrirHorario } from "@/app/actions/schedule-blocks"

export type ScheduleBlock = {
  id: string
  professional_id: string
  start_time: string
  end_time: string
  reason: string | null
  professionals?: { name: string } | null
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

/** Horário fechado na agenda. Clicar abre a confirmação para reabrir. */
export function ScheduleBlockCard({ block, showProfessional }: { block: ScheduleBlock; showProfessional?: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const resumo = `${hora(block.start_time)}–${hora(block.end_time)}`
  const quem = showProfessional && block.professionals?.name ? ` · ${block.professionals.name.split(" ")[0]}` : ""

  async function reabrir() {
    setBusy(true)
    const result = await reabrirHorario(block.id)
    setBusy(false)

    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Horário reaberto.")
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={block.reason ? `Fechado: ${block.reason}` : "Horário fechado"}
        className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/60 px-2 py-1 text-left text-[10px] font-medium text-muted-foreground hover:bg-muted"
      >
        <Ban className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Fechado {resumo}
          {quem}
          {block.reason ? ` · ${block.reason}` : ""}
        </span>
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir este horário?</AlertDialogTitle>
            <AlertDialogDescription>
              {resumo}
              {block.professionals?.name ? ` · ${block.professionals.name}` : ""}
              {block.reason ? ` · ${block.reason}` : ""}. Ele volta a aceitar agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter fechado</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void reabrir()
              }}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
