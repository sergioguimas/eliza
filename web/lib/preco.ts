/**
 * Preço de serviço para exibição ao cliente. `aPartirDe` vem de `services.price_from`:
 * o valor passa a ser o piso e o final é combinado no atendimento.
 * Sem preço (null/0) devolve "Consulte", como a LP já faz com o catálogo público.
 */
/** "R$ 120,00": dinheiro para exibição. */
export function formatarReais(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
}

/** "+ R$ 5,00 por unha": valor do adicional para exibição no painel. */
export function rotuloAdicional(adicional: { valor: number; unidade: string | null }): string {
  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(adicional.valor)
  return adicional.unidade ? `+ ${valor} ${adicional.unidade}` : `+ ${valor}`
}

export function rotuloPreco(servico: { preco: number | null; precoAPartirDe?: boolean }): string {
  const preco = Number(servico.preco)
  if (!preco) return "Consulte"
  const valor = `R$ ${preco.toFixed(2)}`
  return servico.precoAPartirDe ? `a partir de ${valor}` : valor
}
