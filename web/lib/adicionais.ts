import { z } from "zod"

/**
 * Custos adicionais opcionais de um serviço (`services.addons`), ex.: "Unha quebrada",
 * R$ 5 por unha. Só informam o cliente: não entram no preço do agendamento.
 * Sem `server-only`: o formulário do painel usa os limites e a leitura.
 */

export const LIMITE_ADICIONAIS = 10
export const TAMANHO_NOME_ADICIONAL = 60
export const TAMANHO_UNIDADE_ADICIONAL = 30
export const VALOR_MAXIMO_ADICIONAL = 99999.99

export type Adicional = {
  nome: string
  /** Em reais, maior que zero. */
  valor: number
  /** Ex.: "por unha". null = valor fixo. */
  unidade: string | null
}

const Linha = z.object({
  name: z.string().trim().min(1).max(TAMANHO_NOME_ADICIONAL),
  price: z.number().positive().max(VALOR_MAXIMO_ADICIONAL),
  unit: z.string().trim().max(TAMANHO_UNIDADE_ADICIONAL).nullish(),
})

/** Formato gravado na coluna. */
export type LinhaAdicional = { name: string; price: number; unit: string | null }

/**
 * Leitura tolerante: item fora do formato some em vez de derrubar a resposta. O
 * catálogo público tem contrato estrito, e o painel grava com o client de sessão,
 * então um valor inválido na coluna viraria 500 no site do tenant.
 */
export function lerAdicionais(valor: unknown): Adicional[] {
  if (!Array.isArray(valor)) return []

  return valor
    .flatMap((item) => {
      const linha = Linha.safeParse(item)

      return linha.success
        ? [{ nome: linha.data.name, valor: linha.data.price, unidade: linha.data.unit || null }]
        : []
    })
    .slice(0, LIMITE_ADICIONAIS)
}

/** Escrita estrita: `json` é o campo do formulário; item inválido recusa o salvamento. */
export function validarAdicionais(json: string): { addons: LinhaAdicional[] } | { error: string } {
  let bruto: unknown

  try {
    bruto = JSON.parse(json)
  } catch {
    return { error: "Adicionais inválidos." }
  }

  if (!Array.isArray(bruto)) return { error: "Adicionais inválidos." }

  if (bruto.length > LIMITE_ADICIONAIS) {
    return { error: `Cadastre no máximo ${LIMITE_ADICIONAIS} adicionais por serviço.` }
  }

  const addons: LinhaAdicional[] = []

  for (const item of bruto) {
    const linha = Linha.safeParse(item)

    if (!linha.success) {
      return { error: "Confira os adicionais: cada um precisa de nome e de um valor maior que zero." }
    }

    addons.push({
      name: linha.data.name,
      price: Math.round(linha.data.price * 100) / 100,
      unit: linha.data.unit || null,
    })
  }

  return { addons }
}
