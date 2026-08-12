/**
 * Configuração do servidor Evolution.
 *
 * O servidor é ÚNICO para todo o sistema: mesma URL, mesma API key global.
 * O que separa um tenant do outro é a instância (o número de WhatsApp), nunca
 * o servidor — por isso a resolução da instância mora junto de cada org
 * (`organizations.whatsapp_instance_name`) e a do servidor mora aqui.
 *
 * Existiram colunas `organizations.evolution_api_url` / `evolution_api_key`,
 * resíduo de um desenho antigo de um servidor por org. Nunca tiveram efeito (as
 * envs sempre venciam) e foram dropadas na migration 20260809170000.
 *
 * ATENÇÃO: este módulo lê EVOLUTION_API_KEY. Só pode ser importado por código
 * de servidor (server actions, route handlers).
 */

type EvolutionServer = {
  url: string
  apiKey: string
}

export function getEvolutionServer(): EvolutionServer | null {
  // NEXT_PUBLIC_EVOLUTION_API_URL é aceita porque é a que o deploy usa hoje;
  // as duas apontam para o mesmo servidor. Ler só uma delas faria caminhos
  // diferentes do app conversarem com servidores diferentes.
  const url = (
    process.env.EVOLUTION_API_URL ||
    process.env.NEXT_PUBLIC_EVOLUTION_API_URL ||
    ""
  ).replace(/\/$/, "")

  const apiKey = process.env.EVOLUTION_API_KEY || ""

  if (!url || !apiKey) {
    return null
  }

  return { url, apiKey }
}
