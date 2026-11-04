import { z } from "zod"

/**
 * Treino do atendente (contrato 10). Não é a API de Autoatendimento: é a API do
 * sola-agens que o Eliza consome (`specs/06` §5 de lá). Onde divergirem, a spec
 * do agens vence e este arquivo é corrigido.
 *
 * Requests com `.strict()`. Respostas do agens SEM `.strict()`: o agens pode
 * acrescentar campo sem derrubar a tela (C32).
 */

export const HEADER_TREINO_TENANT = "X-Agens-Tenant"
export const HEADER_TREINO_OPERADOR = "X-Agens-Operador-Id"
export const HEADER_TREINO_PAPEL = "X-Agens-Operador-Papel"

export const Perfil = z.object({
  tratamento: z.enum(["voce", "senhor", "pelo_nome"]).nullable(),
  saudacoes: z.array(z.string()).max(5),
  despedidas: z.array(z.string()).max(5),
  emojis: z.object({
    uso: z.enum(["nunca", "pouco", "frequente"]).nullable(),
    preferidos: z.array(z.string()).max(8),
    evitar: z.array(z.string()).max(8),
  }),
  pontuacao: z.object({
    exclamacao: z.enum(["rara", "normal", "muita"]).nullable(),
    reticencias: z.boolean().nullable(),
    risada: z.boolean().nullable(),
  }),
  comprimento: z.enum(["curto", "medio"]).nullable(),
  vocabulario: z.object({ preferir: z.array(z.string()).max(15), evitar: z.array(z.string()).max(15) }),
  tom: z.array(z.string()).max(5),
  exemplos: z.array(z.object({ cenario: z.string(), resposta: z.string() })).max(8),
})
export type Perfil = z.infer<typeof Perfil>

export const RespostaSessao = z.object({ sessaoId: z.string(), resposta: z.string(), nova: z.boolean() })
export type RespostaSessao = z.infer<typeof RespostaSessao>

export const RespostaMensagem = z.object({
  resposta: z.string(),
  ensaiosFeitos: z.number().int(),
  sugerirEncerrar: z.boolean(),
})
export type RespostaMensagem = z.infer<typeof RespostaMensagem>

export const Mudanca = z.object({ campo: z.string(), antes: z.unknown(), depois: z.unknown() })
export type Mudanca = z.infer<typeof Mudanca>

export const RespostaEncerrar = z.object({
  versaoNova: z.number().int().nullable(),
  mudancas: z.array(Mudanca),
  aguardandoEvidencia: z.array(
    z.object({ campo: z.string(), valor: z.string(), sessoes: z.number(), faltam: z.number() })
  ),
  notasNovas: z.array(z.object({ id: z.string(), texto: z.string() })),
  extracaoPendente: z.boolean().optional(),
})
export type RespostaEncerrar = z.infer<typeof RespostaEncerrar>

export const PerfilAtivo = z.object({ versao: z.number().int(), perfil: Perfil, secaoPrompt: z.string() })
export type PerfilAtivo = z.infer<typeof PerfilAtivo>

export const VersaoResumo = z.object({
  versao: z.number().int(),
  ativa: z.boolean(),
  origem: z.string(),
  criadaEm: z.string(),
  mudancas: z.array(Mudanca),
})
export type VersaoResumo = z.infer<typeof VersaoResumo>
export const ListaVersoes = z.object({ versoes: z.array(VersaoResumo) })

export const Observacao = z.object({
  id: z.string(),
  campo: z.string(),
  valor: z.string(),
  origem: z.enum(["extraida", "declarada", "metrica"]),
  estado: z.enum(["candidata", "rejeitada"]),
  sessoes: z.number().int(),
  elegivel: z.boolean(),
  citacao: z.string().nullable(),
})
export type Observacao = z.infer<typeof Observacao>
export const ListaObservacoes = z.object({ observacoes: z.array(Observacao) })

export const Nota = z.object({
  id: z.string(),
  texto: z.string(),
  citacao: z.string().nullable(),
  estado: z.enum(["pendente", "aplicada", "descartada"]),
  criadaEm: z.string(),
})
export type Nota = z.infer<typeof Nota>
export const ListaNotas = z.object({ notas: z.array(Nota) })

export const RespostaAtivar = z.object({
  versao: z.number().int(),
  rejeitadas: z.array(z.object({ id: z.string(), campo: z.string(), valor: z.string() })),
})
export type RespostaAtivar = z.infer<typeof RespostaAtivar>

export const RespostaEdicao = z.object({ versaoNova: z.number().int().nullable(), mudancas: z.array(Mudanca) })
export type RespostaEdicao = z.infer<typeof RespostaEdicao>

export const RespostaMarcar = z.object({ id: z.string(), estado: z.string() })
export const RespostaZerar = z.object({ versao: z.number().int() })
export type RespostaZerar = z.infer<typeof RespostaZerar>

export const TEXTO_TREINO_MAX = 1000 // igual a treino.limites.texto_max do agens
export const MensagemTreinoBody = z.object({ texto: z.string().trim().min(1).max(TEXTO_TREINO_MAX) }).strict()

/** Ids viram parte do caminho assinado: só uuid passa. */
export const IdTreino = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
