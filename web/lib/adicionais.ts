import { z } from "zod"
import { QUANTIDADE_MAXIMA_ADICIONAL } from "@/contracts/comum/adicionais"

/**
 * Custos adicionais opcionais de um serviço (`services.addons`), ex.: "Unha quebrada",
 * R$ 5 por unha. O cliente escolhe ao agendar e a soma entra em `appointments.price`;
 * a cópia do que foi escolhido fica em `appointments.addons`.
 * Sem `server-only`: o formulário do painel usa os limites, a leitura e a soma.
 */

export const LIMITE_ADICIONAIS = 10
export const TAMANHO_NOME_ADICIONAL = 60
export const TAMANHO_UNIDADE_ADICIONAL = 30
export const VALOR_MAXIMO_ADICIONAL = 99999.99

export type Adicional = {
  /** Estável: é a referência usada ao agendar, e não muda se o nome mudar. */
  id: string
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

// Leitura exige id (item sem ele some); escrita aceita sem e gera um.
const LinhaLida = Linha.extend({ id: z.uuid() })
const LinhaEscrita = Linha.extend({ id: z.uuid().optional() })

/** Formato gravado na coluna. */
export type LinhaAdicional = { id: string; name: string; price: number; unit: string | null }

const arredondar = (valor: number) => Math.round(valor * 100) / 100

/**
 * Leitura tolerante: item fora do formato some em vez de derrubar a resposta. O
 * catálogo público tem contrato estrito, e o painel grava com o client de sessão,
 * então um valor inválido na coluna viraria 500 no site do tenant.
 */
export function lerAdicionais(valor: unknown): Adicional[] {
  if (!Array.isArray(valor)) return []

  return valor
    .flatMap((item) => {
      const linha = LinhaLida.safeParse(item)

      return linha.success
        ? [{ id: linha.data.id, nome: linha.data.name, valor: linha.data.price, unidade: linha.data.unit || null }]
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
  const ids = new Set<string>()

  for (const item of bruto) {
    const linha = LinhaEscrita.safeParse(item)

    if (!linha.success) {
      return { error: "Confira os adicionais: cada um precisa de nome e de um valor maior que zero." }
    }

    // Sem id, o item é novo. Sem manter o recebido, salvar o serviço quebraria
    // a referência dos agendamentos e dos canais que guardaram o id.
    const id = linha.data.id ?? crypto.randomUUID()

    if (ids.has(id)) return { error: "Adicionais inválidos." }
    ids.add(id)

    addons.push({
      id,
      name: linha.data.name,
      price: Math.round(linha.data.price * 100) / 100,
      unit: linha.data.unit || null,
    })
  }

  return { addons }
}

/** Adicional já escolhido num agendamento: cópia de nome, valor e unidade da época. */
export type AdicionalAplicado = {
  id: string
  nome: string
  /** Em reais, por unidade. */
  valorUnitario: number
  unidade: string | null
  quantidade: number
  /** `valorUnitario` x `quantidade`, arredondado. */
  total: number
}

const LinhaAplicada = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  price: z.number().positive(),
  unit: z.string().nullish(),
  quantity: z.number().int().min(1).max(QUANTIDADE_MAXIMA_ADICIONAL),
})

/** Leitura tolerante de `appointments.addons`: item fora do formato some, e o `total` é calculado aqui. */
export function lerAdicionaisAplicados(valor: unknown): AdicionalAplicado[] {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((item) => {
    const linha = LinhaAplicada.safeParse(item)

    if (!linha.success) return []

    const { id, name, price, unit, quantity } = linha.data

    return [
      {
        id,
        nome: name,
        valorUnitario: price,
        unidade: unit || null,
        quantidade: quantity,
        total: arredondar(price * quantity),
      },
    ]
  })
}

/** Formato gravado em `appointments.addons`. */
export function adicionaisParaColuna(itens: AdicionalAplicado[]) {
  return itens.map((i) => ({
    id: i.id,
    name: i.nome,
    price: i.valorUnitario,
    unit: i.unidade,
    quantity: i.quantidade,
  }))
}

/**
 * Soma arredondada a centavos. O formulário usa esta mesma função para o total
 * estimado, para a tela não divergir do que o servidor grava.
 */
export function somarAdicionais(itens: { valorUnitario: number; quantidade: number }[]): number {
  return itens.reduce((soma, i) => arredondar(soma + arredondar(i.valorUnitario * i.quantidade)), 0)
}
