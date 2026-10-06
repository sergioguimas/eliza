import { apiRoute } from "@/lib/api/handler"
import { paraProfessional } from "@/lib/api/serializar"
import { listarProfissionaisAtivos } from "@/lib/domain/catalogo"

/** Só id, name e specialty: o domínio nunca devolve phone nem license_number. */
export const GET = apiRoute("read", async ({ db, organizationId }) => ({
  data: (await listarProfissionaisAtivos(db, organizationId)).map(paraProfessional),
}))
