import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { listarProfissionaisAtivos } from "@/lib/domain/catalogo"
import { criarRota } from "@/lib/http/rota"

/** Profissionais ativos da org do ticket; nunca expõe phone nem registro profissional (03). */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org }) => ({
    data: {
      profissionais: (await listarProfissionaisAtivos(db, org)).map((p) => ({
        id: p.id,
        nome: p.nome,
        especialidade: p.especialidade,
      })),
    },
  }),
})
