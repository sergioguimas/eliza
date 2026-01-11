'use client'

import { useKeckleon } from "@/providers/keckleon-provider"
import { 
  Stethoscope, // Estetoscópio
  Scissors, // Tesoura
  Briefcase, // Maleta
  Gavel, // Martelo
  Scale, // Balança
  User, // Usuário
  FileText, // Documento
  Sparkles // Brilho
} from "lucide-react"

interface CategoryIconProps {
  // O que você quer representar?
  name: 'servico' | 'cliente' | 'prontuario' 
  className?: string
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const { dict } = useKeckleon()
    
  // 1. Ícones de SERVIÇO (Procedimento, Corte, Atendimento)
  if (name === 'servico') {
    switch (dict.icon_set) {
      case 'health': return <Stethoscope className={className} />
      case 'grooming': return <Scissors className={className} />
      case 'beauty': return <Sparkles className={className} />
      case 'legal': return <Gavel className={className} />
      default: return <Briefcase className={className} />
    }
  }

  // 2. Ícones de PRONTUÁRIO (Ficha, Histórico, Processo)
  if (name === 'prontuario') {
    switch (dict.icon_set) {
      case 'health': return <FileText className={className} />
      case 'legal': return <Scale className={className} />
      default: return <FileText className={className} />
    }
  }

  // 3. Ícones de CLIENTE (Paciente, Tutor)
  return <User className={className} />
}