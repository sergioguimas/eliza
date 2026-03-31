import {
  Stethoscope,
  Scissors,
  Sparkles,
  Briefcase,
  Scale,
  FileBadge,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NicheId =
  | "clinica"
  | "barbearia"
  | "salao"
  | "advocacia"
  | "generico"
  | "certificado"

export type NicheBrandConfig = {
  themeClass: string
  primaryClass: string
  softClass: string
  borderClass: string
  textClass: string
  shadowClass: string
  radiusStyle: "soft" | "rounded" | "sharp"
}

export type NicheMetadata = {
  id: NicheId
  label: string
  description: string
  icon: LucideIcon
  appTitle: string
  sidebarLabel: string
  themeClass: string
  brand: NicheBrandConfig
}

export const nicheConfig: Record<NicheId, NicheMetadata> = {
  clinica: {
    id: "clinica",
    label: "Saúde / Clínica",
    description: "Para médicos, dentistas e terapeutas.",
    icon: Stethoscope,
    appTitle: "Eliza Clinic",
    sidebarLabel: "Gestão Clínica",
    themeClass: "theme-clinica",
    brand: {
      themeClass: "theme-clinica",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "soft",
    },
  },

  barbearia: {
    id: "barbearia",
    label: "Barbearia",
    description: "Para barbearias e estúdios de corte.",
    icon: Scissors,
    appTitle: "Eliza Barber",
    sidebarLabel: "Gestão da Barbearia",
    themeClass: "theme-barbearia",
    brand: {
      themeClass: "theme-barbearia",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "sharp",
    },
  },

  salao: {
    id: "salao",
    label: "Salão de Beleza",
    description: "Para cabeleireiros, manicures e estética.",
    icon: Sparkles,
    appTitle: "Eliza Beauty",
    sidebarLabel: "Gestão do Salão",
    themeClass: "theme-salao",
    brand: {
      themeClass: "theme-salao",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "rounded",
    },
  },

  advocacia: {
    id: "advocacia",
    label: "Advocacia / Jurídico",
    description: "Para escritórios de advocacia e consultoria jurídica.",
    icon: Scale,
    appTitle: "Eliza Jurídico",
    sidebarLabel: "Gestão Jurídica",
    themeClass: "theme-advocacia",
    brand: {
      themeClass: "theme-advocacia",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "soft",
    },
  },

  generico: {
    id: "generico",
    label: "Outro Negócio",
    description: "Para consultoria e serviços gerais.",
    icon: Briefcase,
    appTitle: "Eliza App",
    sidebarLabel: "Gestão Inteligente",
    themeClass: "theme-generico",
    brand: {
      themeClass: "theme-generico",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "soft",
    },
  },

  certificado: {
    id: "certificado",
    label: "Certificados Digitais",
    description: "Para empresas de certificação digital.",
    icon: FileBadge,
    appTitle: "Eliza Cert",
    sidebarLabel: "Gestão de Certificados",
    themeClass: "theme-certificado",
    brand: {
      themeClass: "theme-certificado",
      primaryClass: "text-brand",
      softClass: "bg-brand-soft",
      borderClass: "border-brand",
      textClass: "text-brand",
      shadowClass: "shadow-brand",
      radiusStyle: "sharp",
    },
  },
}

export function getNicheMetadata(niche?: string): NicheMetadata {
  const key = (niche ?? "generico") as NicheId
  return nicheConfig[key] ?? nicheConfig.generico
}

export const getNicheOptions = () => Object.values(nicheConfig)