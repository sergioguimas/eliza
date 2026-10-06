import { apiRoute } from "@/lib/api/handler"
import { paraService } from "@/lib/api/serializar"
import { listarServicosAtivos } from "@/lib/domain/catalogo"

export const GET = apiRoute("read", async ({ db, organizationId }) => ({
  data: (await listarServicosAtivos(db, organizationId)).map(paraService),
}))
