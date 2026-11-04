import type { Mudanca, Perfil, VersaoResumo } from "@/contracts/autoatendimento"
import type { ErroTreino } from "@/lib/autoatendimento/treino-regras"

/** Linguagem simples do perfil (contrato 10 §5.7). Funções puras, com teste. */

const USO_EMOJI: Record<string, string> = { nunca: "nunca", pouco: "pouco", frequente: "com frequência" }
const TRATAMENTO: Record<string, string> = { voce: "você", senhor: "senhor ou senhora", pelo_nome: "nome" }
const COMPRIMENTO: Record<string, string> = { curto: "curtas", medio: "de tamanho médio" }

export function descreverPerfil(p: Perfil): string[] {
  const linhas: string[] = []
  const aspas = (v: string[]) => v.map((x) => `“${x}”`).join(", ")

  if (p.tratamento) {
    linhas.push(p.tratamento === "pelo_nome" ? "Trata o cliente pelo nome" : `Trata o cliente por ${TRATAMENTO[p.tratamento]}`)
  }
  if (p.tom.length) linhas.push(`Tom: ${p.tom.join(", ")}`)
  if (p.saudacoes.length) linhas.push(`Costuma cumprimentar com: ${aspas(p.saudacoes)}`)
  if (p.despedidas.length) linhas.push(`Costuma se despedir com: ${aspas(p.despedidas)}`)
  if (p.emojis.uso || p.emojis.preferidos.length) {
    const uso = p.emojis.uso ? `Usa emojis ${USO_EMOJI[p.emojis.uso]}` : "Emojis"
    linhas.push(p.emojis.preferidos.length ? `${uso}: ${p.emojis.preferidos.join(" ")}` : uso)
  }
  if (p.emojis.evitar.length) linhas.push(`Nunca usa: ${p.emojis.evitar.join(" ")}`)
  if (p.pontuacao.exclamacao) linhas.push(`Exclamação: ${p.pontuacao.exclamacao}`)
  if (p.pontuacao.reticencias !== null) linhas.push(p.pontuacao.reticencias ? "Usa reticências" : "Não usa reticências")
  if (p.pontuacao.risada !== null) linhas.push(p.pontuacao.risada ? "Ri por escrito (kkk, haha)" : "Não usa “kkk”")
  if (p.comprimento) linhas.push(`Mensagens ${COMPRIMENTO[p.comprimento]}`)
  if (p.vocabulario.preferir.length) linhas.push(`Palavras que usa: ${aspas(p.vocabulario.preferir)}`)
  if (p.vocabulario.evitar.length) linhas.push(`Palavras que evita: ${aspas(p.vocabulario.evitar)}`)
  if (p.exemplos.length) linhas.push(p.exemplos.length === 1 ? "1 exemplo real de resposta" : `${p.exemplos.length} exemplos reais de resposta`)

  return linhas
}

const CAMPOS: Record<string, string> = {
  tratamento: "Tratamento",
  saudacoes: "Saudações",
  despedidas: "Despedidas",
  "emojis.uso": "Uso de emojis",
  "emojis.preferidos": "Emojis preferidos",
  "emojis.evitar": "Emojis que evita",
  "pontuacao.exclamacao": "Exclamação",
  "pontuacao.reticencias": "Reticências",
  "pontuacao.risada": "Risada",
  comprimento: "Tamanho das mensagens",
  "vocabulario.preferir": "Palavras que usa",
  "vocabulario.evitar": "Palavras que evita",
  tom: "Tom",
  exemplos: "Exemplos",
}

export function nomeDoCampo(campo: string) {
  return CAMPOS[campo] ?? campo
}

function valorEmTexto(campo: string, v: unknown): string {
  if (v === null || v === undefined) return "nada"
  if (typeof v === "boolean") return v ? "sim" : "não"
  // Observações guardam o booleano como texto: "sim" e "nao".
  if (v === "nao") return "não"
  if (Array.isArray(v)) {
    if (!v.length) return "nada"
    if (campo === "exemplos") return v.length === 1 ? "1 exemplo" : `${v.length} exemplos`
    return v.join(", ")
  }
  if (campo === "tratamento") return TRATAMENTO[String(v)] ?? String(v)
  if (campo === "comprimento") return COMPRIMENTO[String(v)] ?? String(v)
  if (campo === "emojis.uso") return USO_EMOJI[String(v)] ?? String(v)

  return String(v)
}

/** "Reticências: não", para as listas de padrões (o agens manda o valor interno). */
export function descreverPadrao(campo: string, valor: string) {
  return `${nomeDoCampo(campo)}: ${valorEmTexto(campo, valor)}`
}

export function descreverMudanca(m: Mudanca) {
  return `${nomeDoCampo(m.campo)}: ${valorEmTexto(m.campo, m.antes)} → ${valorEmTexto(m.campo, m.depois)}`
}

/** "treino de 27/10", "voltou para a v3", "edição", "começou do zero" (contrato 10 §5.4). */
export function descreverOrigem(v: Pick<VersaoResumo, "origem" | "criadaEm">) {
  if (v.origem.startsWith("volta:")) return `voltou para a v${v.origem.slice("volta:".length)}`
  if (v.origem === "edicao") return "edição"
  if (v.origem === "zerado") return "começou do zero"

  return `treino de ${dataCurta(v.criadaEm).slice(0, 5)}`
}

/** "27/10/2026". Sempre em Brasília: treino às 21h não pode virar o dia seguinte. */
export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
}

/** Textos de erro (contrato 10 §5.6). */
export const TEXTO_DO_ERRO: Record<ErroTreino, string> = {
  INDISPONIVEL: "O treino está indisponível agora. Tente de novo em alguns minutos.",
  TREINO_DESLIGADO: "O treino está indisponível agora. Tente de novo em alguns minutos.",
  NAO_PERMITIDO: "Só o dono ou um admin pode treinar o atendente.",
  NAO_ENCONTRADO: "Isso não existe mais. Recarregue a página.",
  SESSAO_ENCERRADA: "Este treino já terminou. Comece outro.",
  SESSAO_CHEIA: "Este treino ficou longo. Encerre para eu aprender o que já vi.",
  TEXTO_LONGO: "Mensagem longa demais (até 1.000 caracteres).",
  LIMITE_SESSOES: "Você já fez muitos treinos hoje. Volte amanhã.",
  LIMITE_INSTRUCOES: "As instruções do atendente já estão cheias (2.000 caracteres). Peça ao suporte para revisar.",
}
