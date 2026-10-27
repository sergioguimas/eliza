/**
 * Catálogo PÚBLICO de uma organização: o que já aparece em /marcar/[slug] e
 * nada além. Consumido por sites estáticos dos clientes (ex.: LP da Deborah),
 * que não podem carregar token. Sem autenticação, somente leitura.
 *
 * GET /api/public/v1/orgs/{slug}/catalogo
 * Documentação: docs/API_PUBLICA.md
 *
 * `.strict()` em tudo: se alguém tentar expor campo novo (cliente,
 * profissional, cor, organization_id...) a resposta falha no parse e a rota
 * devolve 500 em vez de vazar. Foi assim que duas RPCs públicas vazaram ficha
 * de cliente em 23/09.
 */
import { z } from "zod"
import { apiSuccess } from "../comum/envelope"

export const LIMITE_SERVICOS_PUBLICOS = 30

export const ServicoPublico = z
  .object({
    id: z.uuid(),
    nome: z.string().min(1).max(120),
    descricao: z.string().max(500).nullable(),
    duracaoMinutos: z.number().int().positive(),
    /** Em reais. null = não divulgar. Preço 0 continua 0 (quem consome decide como mostrar). */
    preco: z.number().nonnegative().nullable(),
    /** true = `preco` é o valor mínimo ("a partir de"); o final é combinado no atendimento. */
    precoAPartirDe: z.boolean(),
    /** Agrupamento opcional (`services.category`, texto livre até 40). null = sem grupo. */
    categoria: z.string().max(40).nullable(),
  })
  .strict()

export const CatalogoPublico = z
  .object({
    organizacao: z.object({ nome: z.string(), slug: z.string() }).strict(),
    servicos: z.array(ServicoPublico).max(LIMITE_SERVICOS_PUBLICOS),
    /**
     * Instante da CONSULTA, não de edição: `services` não tem `updated_at`.
     * Para quem consome, é "quando o Eliza confirmou estes valores pela última vez".
     */
    atualizadoEm: z.iso.datetime(),
  })
  .strict()

export const CatalogoPublicoResposta = apiSuccess(CatalogoPublico).strict()

export type ServicoPublico = z.infer<typeof ServicoPublico>
export type CatalogoPublico = z.infer<typeof CatalogoPublico>
