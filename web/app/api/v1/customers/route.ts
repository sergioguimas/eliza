import { CustomersQuery } from "@/contracts/api-v1/clientes"
import { apiRoute } from "@/lib/api/handler"
import { paraCustomer } from "@/lib/api/serializar"
import { buscarPorTelefone } from "@/lib/domain/clientes"

const LIMITE = 20

/** Busca de clientes do tenant por exatamente um critério: ?phone=, ?document= ou ?q= (nome). Máx. 20, por nome. */
export const GET = apiRoute("read", async ({ db, organizationId, parseQuery }) => {
  const { phone, document, q } = parseQuery(CustomersQuery)

  if (phone) {
    // Casa qualquer forma BR do telefone (com/sem DDI, com/sem o 9º dígito).
    const achados = await buscarPorTelefone(db, organizationId, phone)

    return {
      data: achados
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .slice(0, LIMITE)
        .map(paraCustomer),
    }
  }

  let consulta = db
    .from("customers")
    .select("id, name, phone, email")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name")
    .limit(LIMITE)

  if (document) {
    // Mesma normalização do trigger de customers: só letras e dígitos (RG pode ter letra).
    const normalizado = document.replace(/[^0-9A-Za-z]/g, "")

    if (!normalizado) return { data: [] }

    consulta = consulta.eq("document_normalized", normalizado)
  }

  if (q) {
    // Escapa curingas do LIKE; vírgula/parênteses quebrariam o filtro.
    consulta = consulta.ilike("name", `%${q.replace(/[%_\,()]/g, " ")}%`)
  }

  const { data, error } = await consulta

  if (error) {
    console.error("[api:customers]", error)
    throw error
  }

  return {
    data: (data ?? []).map((c) => paraCustomer({ id: c.id, nome: c.name, telefone: c.phone, email: c.email })),
  }
})
