'use client'

import { useState } from "react"
import { format } from "date-fns"
import { Ban, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { fecharHorario } from "@/app/actions/schedule-blocks"
import { useKeckleon } from "@/providers/keckleon-provider"

type Props = {
  professionals: { id: string; name: string }[]
  defaultDate: Date
  /** Profissional filtrado na agenda ("all" = nenhum). */
  defaultProfessionalId?: string
}

const campo = "border-input bg-background text-foreground"

/**
 * Fecha a agenda num intervalo: o horário passa a contar como ocupado nos
 * horários livres (página pública, API, atendente), sem ser um atendimento.
 */
export function CloseSlotDialog({ professionals, defaultDate, defaultProfessionalId }: Props) {
  const [open, setOpen] = useState(false)
  const [allDay, setAllDay] = useState(false)
  const [pending, setPending] = useState(false)
  const { dict } = useKeckleon()

  const profissional = (dict.entities?.profissional || "Profissional").toLowerCase()
  const inicial =
    defaultProfessionalId && professionals.some((p) => p.id === defaultProfessionalId)
      ? defaultProfessionalId
      : professionals.length === 1
        ? professionals[0].id
        : "todos"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    const result = await fecharHorario(new FormData(event.currentTarget))

    setPending(false)

    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Horário fechado.")
    setOpen(false)
    setAllDay(false)
  }

  const data = format(defaultDate, "yyyy-MM-dd")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-tour="fechar-horario">
          <Ban className="mr-2 h-4 w-4" />
          Fechar horário
        </Button>
      </DialogTrigger>

      <DialogContent className="border-border bg-background text-foreground shadow-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Fechar horário</DialogTitle>
          <DialogDescription>
            O período fica indisponível para agendamento, como se estivesse ocupado. Não é um atendimento: não
            gera cobrança nem lembrete.
          </DialogDescription>
        </DialogHeader>

        {/* `key` zera o formulário (data e profissional) cada vez que o diálogo reabre. */}
        <form key={`${open}-${data}-${inicial}`} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="block-professional" className="text-foreground">
              {profissional.charAt(0).toUpperCase() + profissional.slice(1)}
            </Label>
            <select
              id="block-professional"
              name="professional_id"
              defaultValue={inicial}
              className={`h-9 w-full rounded-md border px-3 text-sm ${campo}`}
            >
              {professionals.length > 1 && <option value="todos">Todos</option>}
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="block-date" className="text-foreground">
                De
              </Label>
              <Input id="block-date" name="date" type="date" required defaultValue={data} className={campo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end-date" className="text-foreground">
                Até (opcional)
              </Label>
              <Input id="block-end-date" name="end_date" type="date" className={campo} />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="all_day"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Dia inteiro
          </label>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="block-start" className="text-foreground">
                  Das
                </Label>
                <Input id="block-start" name="start" type="time" required defaultValue="12:00" className={campo} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="block-end" className="text-foreground">
                  Até as
                </Label>
                <Input id="block-end" name="end" type="time" required defaultValue="14:00" className={campo} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="block-reason" className="text-foreground">
              Motivo (opcional)
            </Label>
            <Input
              id="block-reason"
              name="reason"
              maxLength={200}
              placeholder="Ex.: Consulta médica"
              className={campo}
            />
            <p className="text-xs text-muted-foreground">Só a equipe vê o motivo.</p>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fechar horário"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
