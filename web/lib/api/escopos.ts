import type { ApiScope } from "@/contracts/api-v1"

/**
 * Texto dos escopos para a tela de chaves. Sem `server-only` (o componente é client).
 * Record<ApiScope, ...> faz o compilador exigir um rótulo quando o contrato ganhar escopo novo.
 */
export const ROTULO_ESCOPO: Record<ApiScope, string> = {
  read: "Leitura",
  write: "Escrita",
  payments: "Baixa de pagamento",
}
