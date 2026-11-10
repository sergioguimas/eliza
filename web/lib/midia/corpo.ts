/**
 * Leitura do corpo do upload com teto de bytes (contrato midia-vitrine/01 §5, passo 3). Sem `server-only`
 * de propósito: só usa a API web padrão, então dá para testar isolado.
 *
 * `req.formData()` lê tudo na memória; sem teto, um corpo chunked de GBs derrubaria o container. Aqui o
 * `content-length` é exigido (e conferido antes de ler qualquer byte) e o stream é cortado se o corpo passar
 * do limite mesmo mentindo no header.
 */

export class CorpoGrandeError extends Error {
  constructor() {
    super("corpo acima do limite")
    this.name = "CorpoGrandeError"
  }
}

export class CorpoInvalidoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CorpoInvalidoError"
  }
}

/** Tamanho declarado: inteiro > 0. Ausente ou inválido → `null`. */
export function contentLengthDeclarado(headers: Headers): number | null {
  const bruto = headers.get("content-length")
  if (bruto === null || !/^\d+$/.test(bruto.trim())) return null

  const n = Number(bruto)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Lê o multipart com teto de `max` bytes. Estouro → `CorpoGrandeError`; não é multipart → `CorpoInvalidoError`. */
export async function lerFormLimitado(req: Request, max: number): Promise<FormData> {
  if (!req.body) throw new CorpoInvalidoError("sem corpo")

  let lidos = 0
  let estourou = false

  const limitado = req.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(pedaco, controle) {
        lidos += pedaco.byteLength

        if (lidos > max) {
          estourou = true
          controle.error(new CorpoGrandeError())
          return
        }

        controle.enqueue(pedaco)
      },
    })
  )

  try {
    return await new Response(limitado, { headers: req.headers }).formData()
  } catch (erro) {
    if (estourou || erro instanceof CorpoGrandeError) throw new CorpoGrandeError()
    throw new CorpoInvalidoError("não é multipart/form-data")
  }
}
