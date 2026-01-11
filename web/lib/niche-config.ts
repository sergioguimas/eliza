import { 
  Stethoscope, // Clínica Médica
  Scissors, // Barbearia
  Sparkles, // Salão de Beleza
  Briefcase, // Genérico
  Dog, // Petshop
  Dumbbell, // Academia
  Scale  // Advocacia
} from "lucide-react"

// Definimos o tipo para garantir que todo nicho tenha tudo que precisa
export type NicheMetadata = {
  id: string
  label: string
  description: string
  icon: any
}

// Configuração Centralizada
// A chave (key) deve ser IGUAL ao valor no Banco de Dados e no dictionaries.ts
export const nicheConfig: Record<string, NicheMetadata> = {
  clinica: {
    id: 'clinica',
    label: 'Saúde / Clínica',
    description: 'Para médicos, dentistas e terapeutas.',
    icon: Stethoscope
  },
  barbearia: {
    id: 'barbearia',
    label: 'Barbearia',
    description: 'Para barbearias e estúdios de corte.',
    icon: Scissors
  },
  salao: {
    id: 'salao',
    label: 'Salão de Beleza',
    description: 'Para cabeleireiros, manicures e estética.',
    icon: Sparkles
  },
  advocacia: {
    id: 'advocacia',
    label: 'Advocacia / Juridico',
    description: 'Para escritórios de advocacia e consultoria jurídica.',
    icon: Scale
  },
  generico: {
    id: 'generico',
    label: 'Outro Negócio',
    description: 'Para consultoria e serviços gerais.',
    icon: Briefcase
  }
}

// Helper para transformar o objeto em array (para usar em .map no React)
export const getNicheOptions = () => Object.values(nicheConfig)