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
      required: true,
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

  advocacia: [
    {
      id: "documento_pessoal",
      label: "Documento pessoal",
      description: "Documento oficial do cliente",
      required: true,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "comprovante_endereco",
      label: "Comprovante de endereço",
      description: "Se necessário para o cadastro ou contrato",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "documentos_do_caso",
      label: "Documentos do caso",
      description: "Arquivos relevantes para análise inicial",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
      multiple: true,
    },
  ],

  certificado: [
    {
      id: "documento_com_foto",
      label: "Documento com foto",
      description: "RG, CNH ou documento oficial válido",
      required: true,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "cpf",
      label: "CPF",
      description: "Caso não conste no documento principal",
      required: false,
      accept: DEFAULT_DOCUMENT_ACCEPT,
    },
    {
      id: "comprovante_endereco",
      label: "Comprovante de endereço",
      description: "Documento recente",
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