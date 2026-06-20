export type NicheDocumentItem = {
  id: string
  label: string
  description?: string
  required?: boolean
  accept?: string
  multiple?: boolean
}

export const DEFAULT_DOCUMENT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp"

export const nicheDocuments: Record<string, NicheDocumentItem[]> = {
  clinica: [
    {
      id: "documento_pessoal",
      label: "Documento pessoal",
      description: "CPF, RG ou outro documento de identificação",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "carteirinha_convenio",
      label: "Carteirinha do convênio",
      description: "Envie frente e verso, se aplicável",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "pedido_medico",
      label: "Pedido médico / encaminhamento",
      description: "Se o atendimento exigir",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
  ],

  psicologia: [
    {
      id: "documento_pessoal",
      label: "Documento pessoal",
      description: "CPF, RG ou outro documento de identificação",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "encaminhamento_relatorio",
      label: "Encaminhamento ou relatório",
      description: "Documento opcional enviado por escola, médico, empresa ou outro profissional",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
  ],

  barbearia: [],

  salao: [],

  advocacia: [],

  certificado: [],

  tatuador: [
    {
      id: "referencia_tatuagem",
      label: "Referência da tatuagem",
      description: "Imagem, desenho ou inspiração para orientar a arte",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "documento_pessoal",
      label: "Documento pessoal",
      description: "CPF, RG ou outro documento de identificação",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
  ],

  generico: [],
}

export function getNicheDocuments(
  niche?: string | null
): NicheDocumentItem[] {
  if (!niche) return nicheDocuments.generico
  return nicheDocuments[niche] || nicheDocuments.generico
}
