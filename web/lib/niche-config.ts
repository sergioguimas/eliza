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
  color: string
  soft: string
  selected: string
}

const setupStylesByNiche: Record<string, Omit<SetupNicheOption, "id" | "label" | "description" | "icon">> = {
  clinica: {
    color: "text-blue-600",
    soft: "from-blue-50 to-cyan-50",
    selected: "border-blue-500 bg-blue-50/80 ring-blue-200",
  },
  psicologia: {
    color: "text-violet-700",
    soft: "from-violet-50 to-sky-50",
    selected: "border-violet-500 bg-violet-50/80 ring-violet-200",
  },
  advocacia: {
    color: "text-rose-700",
    soft: "from-rose-50 to-red-50",
    selected: "border-rose-500 bg-rose-50/80 ring-rose-200",
  },
  barbearia: {
    color: "text-orange-600",
    soft: "from-orange-50 to-amber-50",
    selected: "border-orange-500 bg-orange-50/80 ring-orange-200",
  },
  salao: {
    color: "text-pink-600",
    soft: "from-pink-50 to-fuchsia-50",
    selected: "border-pink-500 bg-pink-50/80 ring-pink-200",
  },
  certificado: {
    color: "text-emerald-600",
    soft: "from-emerald-50 to-green-50",
    selected: "border-emerald-500 bg-emerald-50/80 ring-emerald-200",
  },
  tatuador: {
    color: "text-teal-700",
    soft: "from-neutral-50 to-teal-50",
    selected: "border-teal-600 bg-teal-50/80 ring-teal-200",
  },
  generico: {
    color: "text-slate-600",
    soft: "from-slate-50 to-zinc-50",
    selected: "border-slate-500 bg-slate-50/80 ring-slate-200",
  },
}

export function getSetupNicheOptions(): SetupNicheOption[] {
  return Object.values(nicheConfig).map((item) => {
    const setupStyle = setupStylesByNiche[item.id] ?? setupStylesByNiche.generico

    return {
      id: item.id,
      label: item.label,
      description: item.description,
      icon: item.icon,
      color: setupStyle.color,
      soft: setupStyle.soft,
      selected: setupStyle.selected,
    }
  })
}

export type NicheBrandConfig = {
  primary: string
  primarySoft: string
  primaryBorder: string
  primaryForeground: string
  accent: string
  accentSoft: string
  ring: string
  sidebarGradientFrom: string
  sidebarGradientTo: string
  cardGlow: string
}

export type NicheMetadata = {
  id: string
  label: string
  description: string
  icon: any
  appTitle: string
  sidebarLabel: string
  brand: NicheBrandConfig
}

export const nicheConfig: Record<string, NicheMetadata> = {
  clinica: {
    id: "clinica",
    label: "Saúde / Clínica",
    description: "Para médicos, dentistas e terapeutas.",
    icon: Stethoscope,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Clínica",
    brand: {
      primary: "#2563eb",
      primarySoft: "rgba(37, 99, 235, 0.10)",
      primaryBorder: "rgba(37, 99, 235, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#1d4ed8",
      accentSoft: "rgba(29, 78, 216, 0.08)",
      ring: "rgba(37, 99, 235, 0.35)",
      sidebarGradientFrom: "rgba(37, 99, 235, 0.16)",
      sidebarGradientTo: "rgba(29, 78, 216, 0.04)",
      cardGlow: "0 10px 30px rgba(37, 99, 235, 0.12)",
    },
  },

  psicologia: {
    id: "psicologia",
    label: "Psicologia",
    description: "Para psicólogos, terapeutas e consultórios.",
    icon: Brain,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Psicologia",
    brand: {
      primary: "#7c3aed",
      primarySoft: "rgba(124, 58, 237, 0.10)",
      primaryBorder: "rgba(124, 58, 237, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#2563eb",
      accentSoft: "rgba(37, 99, 235, 0.08)",
      ring: "rgba(124, 58, 237, 0.35)",
      sidebarGradientFrom: "rgba(124, 58, 237, 0.14)",
      sidebarGradientTo: "rgba(37, 99, 235, 0.04)",
      cardGlow: "0 10px 30px rgba(124, 58, 237, 0.12)",
    },
  },

  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    description: "Para barbearias e estúdios de corte.",
    icon: Scissors,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Barbearia",
    brand: {
      primary: "#f59e0b",
      primarySoft: "rgba(245, 158, 11, 0.10)",
      primaryBorder: "rgba(245, 158, 11, 0.25)",
      primaryForeground: "#111827",
      accent: "#d97706",
      accentSoft: "rgba(217, 119, 6, 0.08)",
      ring: "rgba(245, 158, 11, 0.35)",
      sidebarGradientFrom: "rgba(245, 158, 11, 0.16)",
      sidebarGradientTo: "rgba(217, 119, 6, 0.04)",
      cardGlow: "0 10px 30px rgba(245, 158, 11, 0.12)",
    },
  },

  salao: {
    id: "salao",
    label: "Salão de Beleza",
    description: "Para beleza e estética.",
    icon: Sparkles,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Beleza",
    brand: {
      primary: "#ec4899",
      primarySoft: "rgba(236, 72, 153, 0.10)",
      primaryBorder: "rgba(236, 72, 153, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#db2777",
      accentSoft: "rgba(219, 39, 119, 0.08)",
      ring: "rgba(236, 72, 153, 0.35)",
      sidebarGradientFrom: "rgba(236, 72, 153, 0.16)",
      sidebarGradientTo: "rgba(219, 39, 119, 0.04)",
      cardGlow: "0 10px 30px rgba(236, 72, 153, 0.12)",
    },
  },

  advocacia: {
    id: "advocacia",
    label: "Advocacia / Jurídico",
    description: "Para escritórios e consultorias jurídicas.",
    icon: Scale,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Jurídica",
    brand: {
      primary: "#334155",
      primarySoft: "rgba(51, 65, 85, 0.10)",
      primaryBorder: "rgba(51, 65, 85, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#1e293b",
      accentSoft: "rgba(30, 41, 59, 0.08)",
      ring: "rgba(51, 65, 85, 0.35)",
      sidebarGradientFrom: "rgba(51, 65, 85, 0.16)",
      sidebarGradientTo: "rgba(30, 41, 59, 0.04)",
      cardGlow: "0 10px 30px rgba(51, 65, 85, 0.12)",
    },
  },

  certificado: {
    id: "certificado",
    label: "Certificados Digitais",
    description: "Para certificadoras e AR.",
    icon: FileBadge,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Certificados",
    brand: {
      primary: "#15803d",
      primarySoft: "rgba(21, 128, 61, 0.10)",
      primaryBorder: "rgba(21, 128, 61, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#166534",
      accentSoft: "rgba(22, 101, 52, 0.08)",
      ring: "rgba(21, 128, 61, 0.35)",
      sidebarGradientFrom: "rgba(21, 128, 61, 0.16)",
      sidebarGradientTo: "rgba(22, 101, 52, 0.04)",
      cardGlow: "0 10px 30px rgba(21, 128, 61, 0.12)",
    },
  },

  tatuador: {
    id: "tatuador",
    label: "Estúdio de Tatuagem",
    description: "Para tatuadores e estúdios de tattoo.",
    icon: Paintbrush,
    appTitle: "Eliza",
    sidebarLabel: "Gestão Tattoo",
    brand: {
      primary: "#0f766e",
      primarySoft: "rgba(15, 118, 110, 0.10)",
      primaryBorder: "rgba(15, 118, 110, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#111827",
      accentSoft: "rgba(17, 24, 39, 0.08)",
      ring: "rgba(15, 118, 110, 0.35)",
      sidebarGradientFrom: "rgba(15, 118, 110, 0.16)",
      sidebarGradientTo: "rgba(17, 24, 39, 0.04)",
      cardGlow: "0 10px 30px rgba(15, 118, 110, 0.12)",
    },
  },

  generico: {
    id: "generico",
    label: "Outro Negócio",
    description: "Para serviços em geral.",
    icon: Briefcase,
    appTitle: "Eliza",
    sidebarLabel: "Gestão",
    brand: {
      primary: "#6366f1",
      primarySoft: "rgba(99, 102, 241, 0.10)",
      primaryBorder: "rgba(99, 102, 241, 0.25)",
      primaryForeground: "#ffffff",
      accent: "#4f46e5",
      accentSoft: "rgba(79, 70, 229, 0.08)",
      ring: "rgba(99, 102, 241, 0.35)",
      sidebarGradientFrom: "rgba(99, 102, 241, 0.16)",
      sidebarGradientTo: "rgba(79, 70, 229, 0.04)",
      cardGlow: "0 10px 30px rgba(99, 102, 241, 0.12)",
    },
  },
}

export function getNicheMetadata(niche: string | null | undefined): NicheMetadata {
  if (!niche || !(niche in nicheConfig)) return nicheConfig.generico
  return nicheConfig[niche]
}

export const getNicheOptions = () => Object.values(nicheConfig)
export type NicheId = keyof typeof nicheConfig
