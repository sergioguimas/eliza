import {
  Clock,
  CheckCircle2,
  UserCheck,
  XCircle,
  UserX,
  PlayCircle,
  MessageCircleWarningIcon,
} from "lucide-react"

export const STATUS_CONFIG: Record<
  string,
  {
    label: string
    color: string
    icon: any
  }
> = {
  pending: {
    label: "Pendente",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    icon: MessageCircleWarningIcon,
  },
  scheduled: {
    label: "Agendado",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    icon: UserCheck,
  },
  arrived: {
    label: "Chegou",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    icon: PlayCircle,
  },
  completed: {
    label: "Finalizado",
    color: "bg-zinc-800 border-zinc-700 text-zinc-400",
    icon: CheckCircle2,
  },
  canceled: {
    label: "Cancelado",
    color: "bg-red-500/10 border-red-500/20 text-red-400",
    icon: XCircle,
  },
  no_show: {
    label: "Faltou",
    color: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    icon: UserX,
  },
}
