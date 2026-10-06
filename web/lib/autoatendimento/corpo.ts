import "server-only"

import type { NextRequest } from "next/server"
import type { z } from "zod"
import { ApiError, validation, zodDetails } from "@/lib/http/erros"

/**
 * Corpo que pode vir vazio (cancelar com motivo opcional, confirmar sem corpo):
 * vazio vale `{}`. Qualquer outra coisa segue as regras do `body` do `criarRota`
 * (INVALID_JSON 400, VALIDATION_ERROR 422).
 */
export async function corpoOpcional<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const texto = (await req.text()).trim()
  let bruto: unknown = {}

  if (texto) {
    try {
      bruto = JSON.parse(texto)
    } catch {
      throw new ApiError("INVALID_JSON", "Corpo da requisição não é um JSON válido.")
    }
  }

  const lido = schema.safeParse(bruto)

  if (!lido.success) throw validation("Dados inválidos.", zodDetails(lido.error))

  return lido.data
}
