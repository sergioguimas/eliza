/**
 * `If-None-Match` confere com o ETag atual? Comparação FRACA (RFC 9110 §8.8.3.2): o prefixo `W/` é
 * ignorado e o cabeçalho pode trazer uma lista ou `*`.
 *
 * Importa atrás de um proxy que comprime: o Cloudflare troca o ETag forte por `W/"..."` quando
 * comprime a resposta, e o navegador devolve esse valor fraco. Com `===` contra o ETag forte, o
 * 304 nunca acontecia para quem aceita gzip/br.
 */
export function etagConfere(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false

  const semPrefixo = (valor: string) => valor.trim().replace(/^W\//, "")
  const alvo = semPrefixo(etag)

  return ifNoneMatch.split(",").some((valor) => {
    const candidato = semPrefixo(valor)

    return candidato === "*" || candidato === alvo
  })
}
