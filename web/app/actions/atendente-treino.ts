"use server"

import {
  IdTreino,
  ListaNotas,
  ListaObservacoes,
  ListaVersoes,
  MensagemTreinoBody,
  PerfilAtivo,
  RespostaAtivar,
  RespostaEdicao,
  RespostaEncerrar,
  RespostaMarcar,
  RespostaMensagem,
  RespostaSessao,
  RespostaZerar,
  type Nota,
  type Observacao,
  type VersaoResumo,
} from "@/contracts/autoatendimento"
import { chamarTreino, TIMEOUT_LLM_MS, TIMEOUT_PADRAO_MS, type Operador } from "@/lib/autoatendimento/treino"
import { acessoTreino } from "@/lib/autoatendimento/treino-acesso"
import { acrescentarInstrucao, type Resultado } from "@/lib/autoatendimento/treino-regras"
import { createAdminClient } from "@/utils/supabase/admin"

/**
 * Server actions do treino (contrato 10 §5). Cada uma confere sessão, papel,
 * add-on e env antes de chamar o agens, mesmo vindo da página que já conferiu.
 * Sem `revalidatePath`: a página é cliente e recarrega o que precisa.
 */

async function comAcesso<T>(fn: (operador: Operador) => Promise<Resultado<T>>): Promise<Resultado<T>> {
  const acesso = await acessoTreino()

  if (acesso.estado === "negado") return { ok: false, erro: "NAO_PERMITIDO" }
  if (acesso.estado === "sem_env") return { ok: false, erro: "INDISPONIVEL" }

  return fn(acesso.operador)
}

function comId<T>(id: string, fn: (id: string) => Promise<Resultado<T>>): Promise<Resultado<T>> {
  const lido = IdTreino.safeParse(id)

  return lido.success ? fn(lido.data) : Promise.resolve({ ok: false, erro: "NAO_ENCONTRADO" })
}

export async function abrirSessaoTreino() {
  return comAcesso((operador) =>
    chamarTreino({ metodo: "POST", caminho: "/sessoes", operador, schema: RespostaSessao, timeoutMs: TIMEOUT_LLM_MS })
  )
}

export async function enviarMensagemTreino(sessaoId: string, texto: string) {
  return comAcesso((operador) =>
    comId(sessaoId, (id) => {
      const lido = MensagemTreinoBody.safeParse({ texto })

      if (!lido.success) return Promise.resolve({ ok: false, erro: "TEXTO_LONGO" } as const)

      return chamarTreino({
        metodo: "POST",
        caminho: `/sessoes/${id}/mensagens`,
        operador,
        corpo: lido.data,
        schema: RespostaMensagem,
        timeoutMs: TIMEOUT_LLM_MS,
      })
    })
  )
}

export async function encerrarSessaoTreino(sessaoId: string) {
  return comAcesso((operador) =>
    comId(sessaoId, (id) =>
      chamarTreino({
        metodo: "POST",
        caminho: `/sessoes/${id}/encerrar`,
        operador,
        schema: RespostaEncerrar,
        timeoutMs: TIMEOUT_LLM_MS,
      })
    )
  )
}

/** Perfil e observações numa action só: o Next roda as actions em fila, e cada uma confere o acesso. */
export async function lerAprendido(): Promise<Resultado<{ perfil: PerfilAtivo; observacoes: Observacao[] }>> {
  return comAcesso(async (operador) => {
    const [perfil, observacoes] = await Promise.all([
      chamarTreino({ metodo: "GET", caminho: "/perfil", operador, schema: PerfilAtivo, timeoutMs: TIMEOUT_PADRAO_MS }),
      chamarTreino({ metodo: "GET", caminho: "/observacoes", operador, schema: ListaObservacoes, timeoutMs: TIMEOUT_PADRAO_MS }),
    ])

    if (!perfil.ok) return perfil
    if (!observacoes.ok) return observacoes

    return { ok: true, dados: { perfil: perfil.dados, observacoes: observacoes.dados.observacoes } }
  })
}

export async function listarVersoes(): Promise<Resultado<VersaoResumo[]>> {
  const r = await comAcesso((operador) =>
    chamarTreino({ metodo: "GET", caminho: "/perfil/versoes", operador, schema: ListaVersoes, timeoutMs: TIMEOUT_PADRAO_MS })
  )

  return r.ok ? { ok: true, dados: r.dados.versoes } : r
}

export async function listarNotas(): Promise<Resultado<Nota[]>> {
  const r = await comAcesso((operador) =>
    chamarTreino({ metodo: "GET", caminho: "/notas", operador, schema: ListaNotas, timeoutMs: TIMEOUT_PADRAO_MS })
  )

  return r.ok ? { ok: true, dados: r.dados.notas } : r
}

export async function ativarVersao(n: number) {
  return comAcesso((operador) => {
    if (!Number.isInteger(n) || n < 1) return Promise.resolve({ ok: false, erro: "NAO_ENCONTRADO" } as const)

    return chamarTreino({
      metodo: "POST",
      caminho: `/perfil/versoes/${n}/ativar`,
      operador,
      schema: RespostaAtivar,
      timeoutMs: TIMEOUT_PADRAO_MS,
    })
  })
}

function mudarObservacao(id: string, acao: "rejeitar" | "restaurar") {
  return comAcesso((operador) =>
    comId(id, (valido) =>
      chamarTreino({
        metodo: "POST",
        caminho: `/observacoes/${valido}/${acao}`,
        operador,
        schema: RespostaEdicao,
        timeoutMs: TIMEOUT_PADRAO_MS,
      })
    )
  )
}

export async function rejeitarObservacao(id: string) {
  return mudarObservacao(id, "rejeitar")
}

export async function restaurarObservacao(id: string) {
  return mudarObservacao(id, "restaurar")
}

export async function zerarPerfil() {
  return comAcesso((operador) =>
    chamarTreino({ metodo: "DELETE", caminho: "/perfil", operador, schema: RespostaZerar, timeoutMs: TIMEOUT_PADRAO_MS })
  )
}

function marcarNota(operador: Operador, id: string, estado: "aplicada" | "descartada") {
  return chamarTreino({
    metodo: "POST",
    caminho: `/notas/${id}/marcar`,
    operador,
    corpo: { estado },
    schema: RespostaMarcar,
    timeoutMs: TIMEOUT_PADRAO_MS,
  })
}

export async function descartarNota(id: string) {
  return comAcesso((operador) => comId(id, (valido) => marcarNota(operador, valido, "descartada")))
}

export type NotaAplicada = { instrucoes: string; aviso?: "MARCACAO_PENDENTE" }

/**
 * Contrato 10 §5.5, nesta ordem (C34): grava primeiro no Eliza e só depois marca
 * no agens. Se a marcação falhar, a instrução já vale; a nota continua pendente e
 * reaplicar não duplica. O contrário perderia a informação.
 */
export async function aplicarNota(id: string): Promise<Resultado<NotaAplicada>> {
  return comAcesso((operador) =>
    comId(id, async (valido) => {
      const notas = await chamarTreino({
        metodo: "GET",
        caminho: "/notas?estado=pendente",
        operador,
        schema: ListaNotas,
        timeoutMs: TIMEOUT_PADRAO_MS,
      })

      if (!notas.ok) return notas

      const nota = notas.dados.notas.find((n) => n.id === valido)

      if (!nota) return { ok: false, erro: "NAO_ENCONTRADO" }

      const db = createAdminClient()
      const { data: config, error } = await db
        .from("autoatendimento_config")
        .select("instrucoes_atendimento")
        .eq("organization_id", operador.tenant)
        .single()

      if (error || !config) {
        console.error("[atendente:treino] ler instruções", error?.message)
        return { ok: false, erro: "INDISPONIVEL" }
      }

      const nova = acrescentarInstrucao(config.instrucoes_atendimento, nota.texto)

      if (nova.tipo === "limite") return { ok: false, erro: "LIMITE_INSTRUCOES" }

      let instrucoes = config.instrucoes_atendimento ?? ""

      if (nova.tipo === "novo") {
        const { error: erroAoGravar } = await db
          .from("autoatendimento_config")
          .update({ instrucoes_atendimento: nova.valor })
          .eq("organization_id", operador.tenant)

        if (erroAoGravar) {
          console.error("[atendente:treino] gravar instruções", erroAoGravar.message)
          return { ok: false, erro: "INDISPONIVEL" }
        }

        instrucoes = nova.valor
      }

      const marcada = await marcarNota(operador, valido, "aplicada")

      return { ok: true, dados: marcada.ok ? { instrucoes } : { instrucoes, aviso: "MARCACAO_PENDENTE" } }
    })
  )
}
