import { autenticarTicket } from "@/lib/autoatendimento/autenticar"
import { listarServicosAtivos } from "@/lib/domain/catalogo"
import { criarRota } from "@/lib/http/rota"

/** Serviços ativos da org do ticket. Não exige cliente identificado (03). */
export const GET = criarRota({
  autenticar: autenticarTicket,
  handler: async ({ db, org }) => ({
    data: {
      servicos: (await listarServicosAtivos(db, org)).map((s) => ({
        id: s.id,
        nome: s.titulo,
        descricao: s.descricao,
        duracaoMinutos: s.duracaoMinutos,
        // null = não divulgar; preço 0 continua 0.
        preco: s.preco ?? null,
      })),
    },
  }),
})
