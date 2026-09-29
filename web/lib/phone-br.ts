/**
 * Formas possíveis em `customers.phone_normalized` para um número recebido
 * do WhatsApp.
 *
 * `phone_normalized` é só `phone` sem não-dígitos (trigger no banco), então o
 * mesmo celular pode estar gravado com ou sem DDI e com ou sem o 9º dígito:
 * o form público grava `55` + número, o painel grava o que o usuário digitou.
 * Do outro lado, o WhatsApp ainda entrega alguns celulares antigos sem o 9
 * (`55 11 8765-4321` no lugar de `55 11 98765-4321`).
 *
 * Devolve um conjunto FECHADO de variantes exatas — nunca sufixo/`ilike`. Um
 * número que não bate exatamente com nenhuma delas não é o cliente.
 */
export function brPhoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "")

  let local: string | null = null

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    local = digits.slice(2)
  } else if (digits.length === 10 || digits.length === 11) {
    local = digits
  }

  // Fora do formato BR (DDI estrangeiro, lixo): só a igualdade literal.
  if (!local) {
    return digits ? [digits] : []
  }

  const ddd = local.slice(0, 2)
  const subscriber = local.slice(2)
  const locals = new Set<string>([local])

  // Celular com 9º dígito -> forma antiga sem ele.
  if (subscriber.length === 9 && subscriber.startsWith("9")) {
    locals.add(ddd + subscriber.slice(1))
  }

  // 8 dígitos começando em 6-9 é celular sem o 9º dígito -> forma atual.
  // 2-5 é fixo: não existe variante com 9.
  if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
    locals.add(`${ddd}9${subscriber}`)
  }

  const variants = new Set<string>()

  for (const value of locals) {
    variants.add(value)
    variants.add(`55${value}`)
  }

  return [...variants]
}
