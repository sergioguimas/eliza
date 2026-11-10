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
import { LIMITE_ADICIONAIS, TAMANHO_NOME_ADICIONAL, TAMANHO_UNIDADE_ADICIONAL } from "@/lib/adicionais"
import { apiSuccess } from "../comum/envelope"

export const LIMITE_SERVICOS_PUBLICOS = 30
export const LIMITE_CATEGORIAS_PUBLICAS = 30
export const LIMITE_VITRINE = 24

/** Custo opcional além de `preco`. Escolhido ao agendar, soma ao valor do agendamento. */
export const AdicionalPublico = z
  .object({
    /** Estável: referência do adicional ao agendar. */
    id: z.uuid(),
    nome: z.string().min(1).max(TAMANHO_NOME_ADICIONAL),
    /** Em reais. */
    valor: z.number().positive(),
    /** Ex.: "por unha". null = valor fixo. */
    unidade: z.string().max(TAMANHO_UNIDADE_ADICIONAL).nullable(),
  })
  .strict()

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
    /** Sempre presente; [] = sem adicionais. */
    adicionais: z.array(AdicionalPublico).max(LIMITE_ADICIONAIS),
  })
  .strict()

/** Foto 3:4 servida pelo Eliza. Arquivo imutável: pode ficar em cache por 1 ano. */
export const FotoPublica = z
  .object({
    /** Variante grande (hoje 960 px de largura). */
    url: z.url(),
    /** Variante pequena (480 px). Use as duas em `srcset`: `${urlPequena} 480w, ${url} 960w`. */
    urlPequena: z.url(),
    /** Dimensões da variante grande, para `width`/`height` do <img> (evita CLS). */
    largura: z.number().int().positive(),
    altura: z.number().int().positive(),
    /** Texto alternativo escrito pela dona. Sempre preenchido. */
    alt: z.string().min(3).max(200),
    /** Cor dominante da foto (#rrggbb), para fundo de ambiente. */
    cor: z.string().regex(/^#[0-9a-f]{6}$/),
  })
  .strict()

/** Categoria de serviço, na ordem definida pela dona no painel. */
export const CategoriaPublica = z
  .object({
    /** Igual ao `categoria` dos serviços (comparar com lower+trim). */
    nome: z.string().min(1).max(40),
    foto: FotoPublica.nullable(),
  })
  .strict()

export const ItemVitrinePublico = z
  .object({
    id: z.uuid(),
    legenda: z.string().min(1).max(60),
    /** Categoria que a foto representa; null = nenhuma (ou deixou de existir). */
    categoria: z.string().max(40).nullable(),
    foto: FotoPublica,
  })
  .strict()

export const CatalogoPublico = z
  .object({
    organizacao: z.object({ nome: z.string(), slug: z.string() }).strict(),
    servicos: z.array(ServicoPublico).max(LIMITE_SERVICOS_PUBLICOS),
    /** Na ordem de exibição. Só categorias usadas por serviços ativos. [] = nenhuma. */
    categorias: z.array(CategoriaPublica).max(LIMITE_CATEGORIAS_PUBLICAS),
    /** Destaques ativos, na ordem. [] = vitrine vazia. */
    vitrine: z.array(ItemVitrinePublico).max(LIMITE_VITRINE),
    /**
     * Instante da CONSULTA, não de edição: `services` não tem `updated_at`.
     * Para quem consome, é "quando o Eliza confirmou estes valores pela última vez".
     */
    atualizadoEm: z.iso.datetime(),
  })
  .strict()

export const CatalogoPublicoResposta = apiSuccess(CatalogoPublico).strict()

export type ServicoPublico = z.infer<typeof ServicoPublico>
export type FotoPublica = z.infer<typeof FotoPublica>
export type CatalogoPublico = z.infer<typeof CatalogoPublico>
