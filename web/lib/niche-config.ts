import {
  Stethoscope,
  Brain,
  Scissors,
  Sparkles,
  Briefcase,
  Scale,
  FileBadge,
  Paintbrush,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type SetupNicheOption = {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export function getSetupNicheOptions(): SetupNicheOption[] {
  return Object.values(nicheConfig).map((item) => {
    return {
      id: item.id,
      label: item.label,
      description: item.description,
      icon: item.icon,
    }
  })
}

export type NicheMetadata = {
  id: string
  label: string
  description: string
  icon: any
  appTitle: string
  sidebarLabel: string
}

export const nicheConfig: Record<string, NicheMetadata> = {
  clinica: {
    id: "clinica",
    label: "Saúde / Clínica",
    description: "Para médicos, dentistas e terapeutas.",
    icon: Stethoscope,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Clínica",
  },

  psicologia: {
    id: "psicologia",
    label: "Psicologia",
    description: "Para psicólogos, terapeutas e consultórios.",
    icon: Brain,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Psicologia",
  },

  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    description: "Para barbearias e estúdios de corte.",
    icon: Scissors,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Barbearia",
  },

  salao: {
    id: "salao",
    label: "Salão de Beleza",
    description: "Para beleza e estética.",
    icon: Sparkles,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Beleza",
  },

  advocacia: {
    id: "advocacia",
    label: "Advocacia / Jurídico",
    description: "Para escritórios e consultorias jurídicas.",
    icon: Scale,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Jurídica",
  },

  certificado: {
    id: "certificado",
    label: "Certificados Digitais",
    description: "Para certificadoras e AR.",
    icon: FileBadge,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Certificados",
  },

  tatuador: {
    id: "tatuador",
    label: "Estúdio de Tatuagem",
    description: "Para tatuadores e estúdios de tattoo.",
    icon: Paintbrush,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Tattoo",
  },

  generico: {
    id: "generico",
    label: "Outro Negócio",
    description: "Para serviços em geral.",
    icon: Briefcase,
    appTitle: "Eliza",
    sidebarLabel: "Gestão",
  },
}

export function getNicheMetadata(niche: string | null | undefined): NicheMetadata {
  if (!niche || !(niche in nicheConfig)) return nicheConfig.generico
  return nicheConfig[niche]
}

export const getNicheOptions = () => Object.values(nicheConfig)
export type NicheId = keyof typeof nicheConfig
