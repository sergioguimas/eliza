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

  barbearia: [],

  salao: [],

  advocacia: [],

  certificado: [],

  generico: [],
}

export function getNicheDocuments(
  niche?: string | null
): NicheDocumentItem[] {
  if (!niche) return nicheDocuments.generico
  return nicheDocuments[niche] || nicheDocuments.generico
}