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
  customerName 
}: ReturnPromptDialogProps) {
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[450px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Agendar Retorno?</AlertDialogTitle>
          <AlertDialogDescription>
            O atendimento de <span className="font-bold text-foreground">{customerName}</span> foi finalizado.
            Deseja deixar o retorno agendado?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid grid-cols-2 gap-3 py-4">
            <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => onConfirm(15)}>
                <span className="font-bold text-lg">15</span>
                <span className="text-xs text-muted-foreground">Dias</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => onConfirm(30)}>
                <span className="font-bold text-lg">30</span>
                <span className="text-xs text-muted-foreground">Dias</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => onConfirm(45)}>
                <span className="font-bold text-lg">45</span>
                <span className="text-xs text-muted-foreground">Dias</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" onClick={() => onConfirm(60)}>
                <span className="font-bold text-lg">60</span>
                <span className="text-xs text-muted-foreground">Dias</span>
            </Button>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel asChild>
              <Button variant="ghost">Não agendar agora</Button>
          </AlertDialogCancel>
          <Button onClick={() => onConfirm(null)}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              Escolher outra data
          </Button>
      </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}