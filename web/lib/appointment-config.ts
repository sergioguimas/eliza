import { 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  XCircle, 
  PlayCircle,
  MessageCircleWarningIcon
} from "lucide-react"

export const STATUS_CONFIG: Record<string, { 
  label: string, 
  color: string, 
  icon: any 
}> = {
  pending: {
    label: "Pendente",
    color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    icon: MessageCircleWarningIcon
  },
  scheduled: {
    label: "Agendado",
    color: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    icon: Clock
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    icon: UserCheck
  },
  arrived: {
    label: "Chegou",
    color: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    icon: PlayCircle
  },
  completed: {
    label: "Finalizado",
    color: "bg-zinc-800 border-zinc-700 text-zinc-400",
    icon: CheckCircle2
  },
  canceled: {
    label: "Cancelado",
    color: "bg-red-500/10 border-red-500/20 text-red-400",
    icon: XCircle
  }
}

export async function checkProfessionalAvailability(
  supabase: any,
  professionalId: string,
  startTime: Date,
  endTime: Date
) {
  const dayOfWeek = startTime.getDay();
  const timeString = startTime.toTimeString().split(' ')[0]; // HH:mm:ss

  // 1. BUSCA HORÁRIO INDIVIDUAL DO PROFISSIONAL
  const { data: profAvail } = await supabase
    .from('professional_availability')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single();

  if (profAvail) {
    // Valida se está dentro do turno do médico
    if (timeString < profAvail.start_time || timeString >= profAvail.end_time) {
      return { available: false, message: "Fora do horário de atendimento do profissional." };
    }

    // Valida se está no intervalo (almoço)
    if (profAvail.break_start && profAvail.break_end) {
      if (timeString >= profAvail.break_start && timeString < profAvail.break_end) {
        return { available: false, message: "O profissional está em horário de intervalo." };
      }
    }
    
    return { available: true };
  }

  // 2. FALLBACK: Se não houver horário individual
  return { available: false, message: "O profissional não possui horários configurados para este dia." };
}

export function generateTimeSlots(start: string, end: string, interval: number) {
  const slots = []
  let current = new Date(`2026-01-01T${start}`)
  const stop = new Date(`2026-01-01T${end}`)

  while (current < stop) {
    slots.push(current.toTimeString().slice(0, 5))
    current = new Date(current.getTime() + interval * 60000)
  }
  return slots
}