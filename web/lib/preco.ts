/**
 * Preço de serviço para exibição ao cliente. `aPartirDe` vem de `services.price_from`:
 * o valor passa a ser o piso e o final é combinado no atendimento.
 * Sem preço (null/0) devolve "Consulte", como a LP já faz com o catálogo público.
 */
export function rotuloPreco(servico: { preco: number | null; precoAPartirDe?: boolean }): string {
  const preco = Number(servico.preco)
  if (!preco) return "Consulte"
  const valor = `R$ ${preco.toFixed(2)}`
  return servico.precoAPartirDe ? `a partir de ${valor}` : valor
}
