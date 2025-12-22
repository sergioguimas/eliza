import { Check, Clock, Play, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

// Mapa de Cores e Ícones para cada Status
export const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  scheduled: { label: "Agendado", color: "bg-blue-600/10 border-blue-600/20 text-blue-400", icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-green-600/10 border-green-600/20 text-green-400", icon: Check },
  waiting: { label: "Na Recepção", color: "bg-orange-600/10 border-orange-600/20 text-orange-400", icon: AlertCircle },
  in_progress: { label: "Em Atendimento", color: "bg-purple-600/10 border-purple-600/20 text-purple-400", icon: Play },
  finished: { label: "Finalizado", color: "bg-zinc-800/50 border-zinc-700 text-zinc-500", icon: CheckCircle2 },
  canceled: { label: "Cancelado", color: "bg-red-900/10 border-red-900/20 text-red-500 opacity-70 line-through", icon: XCircle },
  no_show: { label: "Não Compareceu", color: "bg-zinc-900 border-dashed border-zinc-700 text-zinc-600", icon: XCircle },
}