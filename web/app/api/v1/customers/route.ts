import { apiRoute } from "@/lib/api/handler"
import { ApiError } from "@/lib/http/erros"
import { brPhoneVariants } from "@/lib/phone-br"

/** Busca de clientes do tenant: ?phone=, ?document= ou ?q= (nome). Máx. 20. */
export const GET = apiRoute("read", async ({ db, organizationId, query }) => {
  const phone = query.get("phone")
  const document = query.get("document")?.replace(/\D/g, "")
  const q = query.get("q")?.trim()

  if (!phone && !document && !q) {
    throw new ApiError("VALIDATION_ERROR", 'Informe "phone", "document" ou "q".')
  }

  let builder = db
    .from("customers")
    .select("id, name, phone, email")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name")
    .limit(20)

  if (phone) {
    const variants = brPhoneVariants(phone)
    if (!variants.length) return { data: [] }
    builder = builder.in("phone_normalized", variants)
  }

  if (document) builder = builder.eq("document_normalized", document)

  if (q) {
    // Escapa curingas do LIKE; vírgula/parênteses quebrariam o filtro.
    const safe = q.replace(/[%_\\,()]/g, " ").slice(0, 60)
    builder = builder.ilike("name", `%${safe}%`)
  }

  const { data, error } = await builder

  if (error) {
    console.error("[api:customers]", error.message)
    throw new ApiError("INTERNAL_ERROR", "Erro interno.")
  }

  return { data }
})
