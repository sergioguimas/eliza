import { lerVariante } from "@/lib/midia/armazenamento"

/**
 * Serve /media/<id>/<960|480>.webp SÓ EM DEV (sem nginx). Em produção o Traefik manda /media/ para o nginx
 * e esta rota nem chega a ser alcançada; se chegar, responde 404 (defesa). O Next não serve com confiança
 * arquivo criado em runtime em public/, por isso a pasta de dev é `.media`. Contrato midia-vitrine/01 §3 e 06 §4.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ARQUIVO = /^(960|480)\.webp$/

const naoEncontrada = () => new Response("Not found", { status: 404 })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; arquivo: string }> }) {
  if (process.env.NODE_ENV === "production") return naoEncontrada()

  const { id, arquivo } = await params
  if (!UUID.test(id) || !ARQUIVO.test(arquivo)) return naoEncontrada()

  const dados = await lerVariante(id, arquivo)
  if (!dados) return naoEncontrada()

  return new Response(new Uint8Array(dados), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  })
}
