'use client'

import type { LucideProps } from 'lucide-react'
import {
  Briefcase,
  CalendarDays,
  FileBadge,
  FolderOpen,
  Gavel,
  HeartPulse,
  Scissors,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react'
import { useKeckleon } from '@/providers/keckleon-provider'

type CategoryIconName =
  | 'logo'
  | 'clientes'
  | 'servicos'
  | 'agenda'
  | 'dashboard'
  | 'documentos'

type IconComponent = React.ComponentType<LucideProps>

type IconMap = Record<CategoryIconName, IconComponent>

const genericoIcons: IconMap = {
  logo: Briefcase,
  clientes: Users,
  servicos: FolderOpen,
  agenda: CalendarDays,
  dashboard: Briefcase,
  documentos: FolderOpen,
}

const clinicaIcons: IconMap = {
  logo: Stethoscope,
  clientes: UserRound,
  servicos: HeartPulse,
  agenda: CalendarDays,
  dashboard: Stethoscope,
  documentos: FolderOpen,
}

const barbeariaIcons: IconMap = {
  logo: Scissors,
  clientes: Users,
  servicos: Scissors,
  agenda: CalendarDays,
  dashboard: Scissors,
  documentos: FolderOpen,
}

const salaoIcons: IconMap = {
  logo: Sparkles,
  clientes: Users,
  servicos: Sparkles,
  agenda: CalendarDays,
  dashboard: Sparkles,
  documentos: FolderOpen,
}

const advocaciaIcons: IconMap = {
  logo: Gavel,
  clientes: UserRound,
  servicos: Briefcase,
  agenda: CalendarDays,
  dashboard: Gavel,
  documentos: FolderOpen,
}

const certificadoIcons: IconMap = {
  logo: FileBadge,
  clientes: Users,
  servicos: ShieldCheck,
  agenda: CalendarDays,
  dashboard: FileBadge,
  documentos: FileBadge,
}

const iconRegistry: Record<string, IconMap> = {
  generico: genericoIcons,
  clinica: clinicaIcons,
  barbearia: barbeariaIcons,
  salao: salaoIcons,
  advocacia: advocaciaIcons,
  certificado: certificadoIcons,
}

type CategoryIconProps = LucideProps & {
  name: CategoryIconName
  fallback?: IconComponent
}

export function CategoryIcon({
  name,
  fallback,
  className,
  ...props
}: CategoryIconProps) {
  const { niche } = useKeckleon()

  const icons = iconRegistry[niche] ?? genericoIcons
  const Icon = icons[name] ?? fallback ?? genericoIcons[name] ?? Briefcase

  return <Icon className={className} {...props} />
}