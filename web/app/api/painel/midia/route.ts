import "server-only"

import type { NextRequest } from "next/server"

import {
  AltMidia,
  LIMITE_FOTOS_ATIVAS,
  RecorteMidia,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
  UploadMidiaResposta,
} from "@/contracts/painel/midia"
import { consumeRateLimit } from "@/lib/demo/rate-limit"
import { contarFotosAtivas, criarMidia } from "@/lib/domain/midia"
import { ApiError, validation } from "@/lib/http/erros"
import { criarRota } from "@/lib/http/rota"
import { apagarDiretorio, gravarVariantes, novoIdDeMidia } from "@/lib/midia/armazenamento"
import { MENSAGEM_PLANO_SEM_VITRINE, planoPermiteVitrine } from "@/lib/midia/planos"
import { CorpoGrandeError, contentLengthDeclarado, lerFormLimitado } from "@/lib/midia/corpo"
import { processarFoto, ProcessamentoError } from "@/lib/midia/processar"
import { exigirGestorDaOrg } from "@/lib/painel-sessao"

export const runtime = "nodejs"

/**
 * POST /api/painel/midia — sobe uma foto para a biblioteca da org (contrato midia-vitrine/01 §5).
 * Rota e não server action (MV15): action tem limite de 1 MB de corpo. Auth é a sessão do painel
 * (cookie), não API key, então não usa `apiRoute`; a casca, o envelope e o `request_id` são os da v1.
 */

const LIMITE_CONTENT_LENGTH = 8.5 * 1024 * 1024
const TAXA = { windowMs: 60 * 60 * 1000, max: 30 }

/**
 * Defesa explícita contra POST de outra origem (route handler não tem a checagem de Origin da server action;
 * os cookies Lax já seguram o cross-site). Com `Origin`: tem de ser a origem do app (NEXT_PUBLIC_APP_URL); em
 * dev (ou sem a variável) vale também a origem do próprio request. Sem `Origin` (curl), segue.
 */
function origemPermitida(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true

  const configurada = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
  const permitidas = new Set<string>()

  if (configurada) {
    try {
      permitidas.add(new URL(configurada).origin)
    } catch {
      // URL malformada: cai na regra do request abaixo
    }
  }

  if (process.env.NODE_ENV !== "production" || permitidas.size === 0) permitidas.add(req.nextUrl.origin)

  return permitidas.has(origin)
}

export const POST = criarRota({
  // 0, 1 e 2. origem (403), sessão (401) e papel owner/admin (403)
  async autenticar(req) {
    if (!origemPermitida(req)) throw new ApiError("FORBIDDEN", "Origem não permitida.")

    const sessao = await exigirGestorDaOrg()

    if ("error" in sessao) {
      throw new ApiError(sessao.motivo, sessao.error)
    }

    return { organizationId: sessao.organizationId, userId: sessao.userId }
  },

  async handler({ req, db, requestId, organizationId, userId }) {
    // 3. corpo, ANTES de qualquer consulta ao banco ou gasto de cota: content-length obrigatório e conferido
    //    antes de ler; leitura em stream com teto (corpo que mente no header é cortado); depois os campos.
    const declarado = contentLengthDeclarado(req.headers)

    if (declarado === null) throw validation("Envio sem tamanho declarado.")
    if (declarado > LIMITE_CONTENT_LENGTH) throw new ApiError("MEDIA_TOO_LARGE", "A foto passa de 8 MB. Escolha uma menor.")

    let form: FormData

    try {
      form = await lerFormLimitado(req, LIMITE_CONTENT_LENGTH)
    } catch (erro) {
      if (erro instanceof CorpoGrandeError) throw new ApiError("MEDIA_TOO_LARGE", "A foto passa de 8 MB. Escolha uma menor.")
      throw validation("Envie a foto como formulário (multipart/form-data).")
    }

    const arquivo = form.get("arquivo")
    const detalhes: { field: string; message: string }[] = []

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      detalhes.push({ field: "arquivo", message: "Escolha uma foto." })
    } else if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new ApiError("MEDIA_TOO_LARGE", "A foto passa de 8 MB. Escolha uma menor.")
    } else if (!(TIPOS_ACEITOS as readonly string[]).includes(arquivo.type)) {
      detalhes.push({ field: "arquivo", message: "Envie uma foto JPEG, PNG ou WebP." })
    }

    const brutoRecorte = form.get("recorte")
    let recorte: ReturnType<typeof RecorteMidia.parse> | null = null

    if (typeof brutoRecorte !== "string") {
      detalhes.push({ field: "recorte", message: "Informe o recorte da foto." })
    } else {
      let json: unknown

      try {
        json = JSON.parse(brutoRecorte)
      } catch {
        json = undefined
      }

      const lido = RecorteMidia.safeParse(json)

      if (lido.success) recorte = lido.data
      else detalhes.push({ field: "recorte", message: "Recorte inválido." })
    }

    const brutoAlt = form.get("alt")
    const altLido = AltMidia.safeParse(typeof brutoAlt === "string" ? brutoAlt : "")

    if (!altLido.success) {
      detalhes.push({ field: "alt", message: altLido.error.issues[0]?.message ?? "Descrição inválida." })
    }

    if (detalhes.length > 0 || !(arquivo instanceof File) || !recorte || !altLido.success) {
      throw validation("Dados inválidos.", detalhes)
    }

    // 4. org demo ou suspensa: mesma regra de lib/api/autenticar-chave.ts
    const { data: org } = await db
      .from("organizations")
      .select("subscription_status, is_demo, plan")
      .eq("id", organizationId)
      .maybeSingle()

    if (!org || org.is_demo || org.subscription_status === "suspended") {
      throw new ApiError("ORGANIZATION_SUSPENDED", "Organização indisponível para envio de fotos.")
    }

    // 5. plano (MV12)
    if (!planoPermiteVitrine(org.plan)) {
      throw new ApiError("PLAN_REQUIRED", MENSAGEM_PLANO_SEM_VITRINE)
    }

    // 6. taxa: 30 envios por hora por org
    const taxa = await consumeRateLimit(db, `midia:${organizationId}`, TAXA)

    if (!taxa.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        "Muitos envios de foto. Tente novamente mais tarde.",
        undefined,
        taxa.retryAfterSeconds ? { "Retry-After": String(taxa.retryAfterSeconds) } : undefined
      )
    }

    // 7. cota: 80 fotos ativas
    if ((await contarFotosAtivas(db, organizationId)) >= LIMITE_FOTOS_ATIVAS) {
      throw new ApiError(
        "MEDIA_LIMIT_REACHED",
        `A biblioteca chegou a ${LIMITE_FOTOS_ATIVAS} fotos. Exclua as que não usa mais.`
      )
    }

    // 8. decodifica e reescreve (nunca salva o original)
    let processada: Awaited<ReturnType<typeof processarFoto>>

    try {
      processada = await processarFoto(Buffer.from(await arquivo.arrayBuffer()), recorte)
    } catch (erro) {
      if (erro instanceof ProcessamentoError && erro.codigo === "OCUPADO") {
        throw new ApiError("RATE_LIMITED", erro.message, undefined, { "Retry-After": "5" })
      }

      if (erro instanceof ProcessamentoError) {
        throw validation(erro.message, [{ field: erro.codigo === "FORMATO" ? "arquivo" : "recorte", message: erro.message, code: erro.codigo }])
      }
      throw erro
    }

    // 9. disco e depois banco; se o banco falhar, não deixa diretório órfão
    const id = novoIdDeMidia()
    const grande = processada.variantes.find((v) => v.largura === 960)!

    await gravarVariantes(
      id,
      processada.variantes.map((v) => ({ largura: v.largura, dados: v.dados }))
    )

    let midia: Awaited<ReturnType<typeof criarMidia>>

    try {
      midia = await criarMidia(db, organizationId, userId, {
        id,
        alt: altLido.data,
        cor: processada.cor,
        largura: grande.larguraReal,
        altura: grande.altura,
        bytes: processada.bytes,
      })
    } catch (erro) {
      await apagarDiretorio(id).catch((e) => console.error("[api:painel/midia] rollback falhou:", { requestId, e }))
      throw erro
    }

    // a resposta sai conferida contra o contrato (strict): campo a mais ou a menos vira 500, não vazamento
    const corpo = UploadMidiaResposta.parse({ data: midia })

    return { data: corpo.data, status: 201 }
  },
})
