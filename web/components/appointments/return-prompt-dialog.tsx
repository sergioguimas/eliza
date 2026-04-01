'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Clock } from "lucide-react"
import { useKeckleon } from "@/providers/keckleon-provider"

interface ReturnPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (daysToAdd: number | null) => void
  customerName?: string
}

export function ReturnPromptDialog({
  open,
  onOpenChange,
  onConfirm,
  customerName,
}: ReturnPromptDialogProps) {
  const { dict } = useKeckleon()

  const entities = dict.entities || {}
  const actions = dict.actions || {}
  const messages = dict.messages || {}

  const cliente = entities.cliente || "Cliente"
  const agendamento = entities.agendamento || "Agendamento"

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[450px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {messages.return_suggestion_label || "Sugestão de retorno"}
            </span>
          </div>

          <AlertDialogTitle>
            {messages.return_prompt_title || "Agendar retorno?"}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {messages.return_prompt_description_prefix ||
              "O atendimento de"}{" "}
            <span className="font-bold text-foreground">
              {customerName || cliente.toLowerCase()}
            </span>{" "}
            {messages.return_prompt_description_suffix ||
              "foi registrado. Deseja deixar o próximo agendamento preparado?"}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {[15, 30, 45, 60].map((days) => (
            <Button
              key={days}
              variant="outline"
              className="flex flex-col h-auto py-3 gap-1 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              onClick={() => onConfirm(days)}
            >
              <span className="font-bold text-lg">{days}</span>
              <span className="text-xs text-muted-foreground">
                {messages.days_label || "Dias"}
              </span>
            </Button>
          ))}
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel asChild>
            <Button variant="ghost" className="w-full sm:w-auto">
              {actions.not_now || "Agora não"}
            </Button>
          </AlertDialogCancel>

          <Button
            onClick={() => onConfirm(null)}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {actions.pick_another_date || "Escolher outra data"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}