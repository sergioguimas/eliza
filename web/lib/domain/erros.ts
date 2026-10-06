import "server-only"

export type CodigoDominio =
  | "NOT_FOUND"            // recurso inexistente OU de outro tenant (nunca diferenciar)
  | "VALIDATION_ERROR"     // entrada malformada (data inválida, campo faltando)
  | "SLOT_UNAVAILABLE"     // horário fora de expediente, ocupado, fora da grade
  | "INVALID_TRANSITION"   // máquina de status ou guarda de edição/pagamento
  | "CUSTOMER_AMBIGUOUS"   // mais de um cadastro casa com telefone/documento
  | "CUSTOMER_CONFLICT"    // documento já pertence a outro cliente

/**
 * Erro de regra de negócio do domínio. `message` é em português e pode ir
 * direto ao usuário final; nunca carrega dado de outro cliente. Quem chama
 * converte: a action em `{ error: message }`, a API no seu envelope.
 */
export class DomainError extends Error {
  constructor(
    public codigo: CodigoDominio,
    message: string,
    public detalhes?: unknown
  ) {
    super(message)
    this.name = "DomainError"
  }
}
