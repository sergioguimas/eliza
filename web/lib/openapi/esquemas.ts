import { z } from "zod"

/**
 * Ponte Zod -> JSON Schema (draft 2020-12, que é o dialeto do OpenAPI 3.1).
 *
 * Os schemas nomeados ficam em dois registries, um por direção, porque o Zod 4
 * gera formas diferentes para a mesma definição:
 *   - `entrada` (`io: "input"`): bodies e queries. `.default()` e `.optional()`
 *     saem como campo opcional com `default`; `z.coerce.number()` sai `integer`.
 *   - `saida` (`io: "output"`): respostas. Campos com `.default()` passam a ser
 *     obrigatórios (a resposta sempre os traz).
 * Um schema usado nos dois lados (ex.: o enum de status) é registrado nos dois
 * com o mesmo id e tem de gerar JSON idêntico, senão `componentes()` lança.
 */

type Meta = { id: string }
type Objeto = Record<string, unknown>

export type Ref = { $ref: string }

const MAX_SEGURO = Number.MAX_SAFE_INTEGER
const FORMATOS_COM_PATTERN_RUIDOSO = new Set(["uuid", "date-time", "email"])

/** O JSON Schema do Zod traz regex gigantes para uuid/date-time/email: o `format` já diz tudo. */
function limpar(no: unknown, io: "input" | "output"): unknown {
  if (Array.isArray(no)) return no.map((item) => limpar(item, io))
  if (!no || typeof no !== "object") return no

  const origem = no as Objeto
  const destino: Objeto = {}

  for (const [chave, valor] of Object.entries(origem)) {
    if (chave === "$schema" || chave === "$id") continue
    if (chave === "pattern" && typeof origem.format === "string" && FORMATOS_COM_PATTERN_RUIDOSO.has(origem.format)) continue
    if (chave === "maximum" && valor === MAX_SEGURO) continue
    // Resposta pode ganhar campos sem aviso: não prometer "additionalProperties: false" ao cliente.
    if (chave === "additionalProperties" && valor === false && io === "output") continue

    destino[chave] = limpar(valor, io)
  }

  return destino
}

export class Componentes {
  private readonly entrada = z.registry<Meta>()
  private readonly saida = z.registry<Meta>()
  private readonly vistos = { input: new Set<string>(), output: new Set<string>() }

  /** Registra `schema` em components.schemas e devolve o `$ref` para usá-lo. */
  registrar(io: "input" | "output", id: string, schema: z.ZodType): Ref {
    if (!this.vistos[io].has(id)) {
      schema.register(io === "input" ? this.entrada : this.saida, { id })
      this.vistos[io].add(id)
    }

    return { $ref: `#/components/schemas/${id}` }
  }

  /** Marca vários de uma vez, nas duas direções (enums e tipos de base). */
  registrarNosDois(id: string, schema: z.ZodType): Ref {
    this.registrar("input", id, schema)
    return this.registrar("output", id, schema)
  }

  /** components.schemas gerado dos Zod. */
  componentes(): Record<string, Objeto> {
    const gerar = (registry: z.core.$ZodRegistry<Meta>, io: "input" | "output") => {
      const { schemas } = z.toJSONSchema(registry, {
        target: "draft-2020-12",
        io,
        unrepresentable: "any",
        uri: (id) => `#/components/schemas/${id}`,
      }) as { schemas: Record<string, unknown> }

      return Object.fromEntries(Object.entries(schemas).map(([id, json]) => [id, limpar(json, io) as Objeto]))
    }

    const resultado = gerar(this.saida, "output")

    for (const [id, json] of Object.entries(gerar(this.entrada, "input"))) {
      const existente = resultado[id]

      if (existente && JSON.stringify(existente) !== JSON.stringify(json)) {
        throw new Error(`OpenAPI: o schema "${id}" gera JSON diferente na entrada e na saída; registre com ids distintos.`)
      }

      resultado[id] = json
    }

    return resultado
  }
}

/** Zod -> JSON Schema inline (para query params, que não viram componente). */
export function jsonInline(schema: z.ZodType, io: "input" | "output" = "input"): Objeto {
  return limpar(z.toJSONSchema(schema, { target: "draft-2020-12", io, unrepresentable: "any" }), io) as Objeto
}

export type ParametroDeQuery = {
  name: string
  in: "query"
  required: boolean
  description: string
  schema: Objeto
}

/**
 * Query params a partir de um `z.object` de entrada. A descrição de cada campo é
 * escrita à mão (o Zod não a carrega); campo sem descrição falha de propósito,
 * para ninguém esquecer de documentar um parâmetro novo.
 */
export function parametrosDeQuery(schema: z.ZodType, descricoes: Record<string, string>): ParametroDeQuery[] {
  const json = jsonInline(schema, "input") as { properties?: Record<string, Objeto>; required?: string[] }
  const obrigatorios = new Set(json.required ?? [])

  return Object.entries(json.properties ?? {}).map(([name, esquema]) => {
    const description = descricoes[name]

    if (!description) throw new Error(`OpenAPI: falta descrição do parâmetro de query "${name}".`)

    return { name, in: "query" as const, required: obrigatorios.has(name), description, schema: esquema }
  })
}

/** Acrescenta `description` a campos de um schema já gerado (campos que são `$ref` mantêm o ref). */
export function anotar(componentes: Record<string, Objeto>, id: string, descricoes: Record<string, string>) {
  const alvo = componentes[id] as { properties?: Record<string, Objeto> } | undefined

  if (!alvo?.properties) throw new Error(`OpenAPI: schema "${id}" não existe ou não é objeto.`)

  for (const [campo, description] of Object.entries(descricoes)) {
    const propriedade = alvo.properties[campo]

    if (!propriedade) throw new Error(`OpenAPI: "${id}" não tem o campo "${campo}".`)

    propriedade.description = description
  }
}
