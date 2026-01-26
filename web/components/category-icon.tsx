'use client'

import { useKeckleon } from "@/providers/keckleon-provider"
import { 
  // Genéricos
  LayoutGrid, 
  Users, 
  Calendar, 
  Briefcase,
  
  // Clínica
  Stethoscope, 
  Activity, 
  HeartPulse,

  // Barbearia/Salão
  Scissors, 
  Sparkles, 
  Brush,
  
  // Advocacia
  Scale, 
  Gavel, 
  ScrollText,
  
  // Certificado
  FileBadge,

  // Fallback
  HelpCircle,
  LucideIcon,
} from "lucide-react"

// Mapeamento dos ícones por Nicho
const ICON_MAP: Record<string, Record<string, LucideIcon>> = {
  clinica: {
    logo: Stethoscope,
    dashboard: Activity,
    agendamentos: Calendar,
    clientes: HeartPulse, // Ou Users
    servicos: Stethoscope,
  },
  barbearia: {
    logo: Scissors,
    dashboard: LayoutGrid,
    agendamentos: Calendar,
    clientes: Users,
    servicos: Scissors,
  },
  salao: {
    logo: Sparkles,
    dashboard: LayoutGrid,
    agendamentos: Calendar,
    clientes: Users,
    servicos: Brush,
  },
  advocacia: {
    logo: Scale,
    dashboard: LayoutGrid,
    agendamentos: Calendar,
    clientes: Users,
    servicos: Gavel,
  },
  certificado: {
    logo: FileBadge,
    dashboard: LayoutGrid,
    agendamentos: Calendar,
    clientes: Users,
    servicos: FileBadge,
  },
  // Default/Genérico
  generico: {
    logo: LayoutGrid,
    dashboard: LayoutGrid,
    agendamentos: Calendar,
    clientes: Users,
    servicos: Briefcase,
  }
}

interface CategoryIconProps {
  name: 'logo' | 'dashboard' | 'agendamentos' | 'clientes' | 'servicos'
  className?: string
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  // Busca o nicho do contexto (se falhar, usa generico)
  const { niche } = useKeckleon()
  
  const currentNiche = niche || 'generico'

  // 1. Tenta pegar o mapa do nicho atual
  const nicheIcons = ICON_MAP[currentNiche] || ICON_MAP['generico']

  // 2. Tenta pegar o ícone específico, se não achar, pega do genérico, se não achar, usa HelpCircle
  const IconComponent = nicheIcons[name] || ICON_MAP['generico'][name] || HelpCircle

  return <IconComponent className={className} />
}