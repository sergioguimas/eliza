'use server'

import { createClient } from "@/utils/supabase/server"
import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/utils/database.types"
import { getEvolutionServer } from "@/lib/evolution"

// --- TIPAGEM ---
export type WhatsappResponse = {
  success?: boolean
  error?: string
  qrcode?: string
  connected?: boolean
  status?: string
}

// Helper para esperar (usado no fallback)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Nome da instância da org na Evolution.
 *
 * O slug só define o nome na PRIMEIRA conexão. A partir do momento em que
 * `organizations.whatsapp_instance_name` está gravado, ele é a fonte de
 * verdade — o slug pode mudar sem quebrar o vínculo com a instância já
 * criada na Evolution.
 */
function resolveInstanceName(org: {
  slug: string | null
  whatsapp_instance_name: string | null
}) {
  return org.whatsapp_instance_name || org.slug
}

async function persistInstanceName(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  instanceName: string
) {
  const { error } = await supabase
    .from("organizations")
    .update({ whatsapp_instance_name: instanceName })
    .eq("id", organizationId)

  if (error) {
    console.error(
      "[whatsapp-connect] Falha ao gravar whatsapp_instance_name:",
      error.message
    )

    return
  }

  console.log(
    `[whatsapp-connect] Instância "${instanceName}" vinculada à org ${organizationId}.`
  )
}

function normalizeEvolutionState(data: any) {
  return (
    data?.instance?.state ||
    data?.instance?.connectionStatus ||
    data?.state ||
    data?.connectionStatus ||
    data?.status ||
    ""
  ).toString().toLowerCase()
}

function isEvolutionConnected(data: any) {
  const state = normalizeEvolutionState(data)

  return [
    "open",
    "connected",
    "online",
  ].includes(state)
}

export async function createWhatsappInstance(): Promise<WhatsappResponse> {
  console.log("--- [DEBUG] INICIANDO PROCESSO DE CONEXÃO WHATSAPP ---")
  
  const supabase = await createClient<Database>()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    console.error("[DEBUG ERROR] Usuário não autenticado")
    return { error: "Usuário não autenticado" }
  }

  // 1. Busca dados da Organização
  console.log("[DEBUG STEP 1] Buscando perfil e organização...")
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations:organization_id(slug, whatsapp_instance_name)')
    .eq('id', user.id)
    .single()

  const org = profile?.organizations

  if (!profile?.organization_id || !org) {
    console.error("[DEBUG ERROR] Organização não encontrada para o usuário")
    return { error: "Organização não encontrada." }
  }

  const organizationId = profile.organization_id
  const instanceName = resolveInstanceName(org)

  if (!instanceName) {
    console.error("[DEBUG ERROR] Organização sem slug e sem instância gravada")
    return { error: "Organização sem identificador para criar a instância." }
  }

  const server = getEvolutionServer()

  if (!server) {
    console.error("[DEBUG ERROR] Servidor Evolution não configurado")
    return { error: "Servidor Evolution não configurado." }
  }

  const EVOLUTION_URL = server.url
  const API_KEY = server.apiKey

  console.log(`[DEBUG STEP 2] Configuração definida:`)
  console.log(`- Instance Name: ${instanceName} (${org.whatsapp_instance_name ? 'do banco' : 'do slug — primeira conexão'})`)
  console.log(`- URL Alvo: ${EVOLUTION_URL}`)
  console.log(`- API Key (final): ***${API_KEY.slice(-3)}`)

  // Toda saída de sucesso passa por aqui: se a instância existe na Evolution,
  // o vínculo org -> instância é gravado. Sem isso o envio cai no fail-closed
  // de send-whatsapp.ts e o webhook de entrada não acha a org.
  const withPersist = async (result: WhatsappResponse) => {
    if (result.success && org.whatsapp_instance_name !== instanceName) {
      await persistInstanceName(supabase, organizationId, instanceName)
    }

    return result
  }

  // 2. Verifica se a instância JÁ EXISTE antes de tentar criar
  console.log("[DEBUG STEP 3] Verificando se instância já existe na API...")
  try {
      const checkRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
          method: 'GET',
          headers: { 'apikey': API_KEY! },
          cache: 'no-store'
      })

      if (checkRes.ok) {
          console.log("[DEBUG STEP 3.1] Instância já existe! Pulando criação e buscando QR Code...")
          return withPersist(await connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!))
      } else {
          console.log(`[DEBUG STEP 3.2] Instância não encontrada (Status ${checkRes.status}). Vamos criar.`)
      }
  } catch (error) {
      console.log("[DEBUG STEP 3.3] Erro ao checar status (pode ser firewall ou url errada):", error)
  }

  // 3. Tenta Criar a Instância (Com Timeout Estendido)
  try {
    console.log("[DEBUG STEP 4] Enviando comando /instance/create...")
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)

    const response = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY!
      },
      body: JSON.stringify({
        instanceName: instanceName,
        token: Math.random().toString(36).substring(7),
        qrcode: true, // Já pede o QR na resposta
        integration: "WHATSAPP-BAILEYS" 
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId) // Cancela o timer se respondeu a tempo

    const data = await response.json()
    console.log("[DEBUG STEP 5] Resposta da criação recebida:", JSON.stringify(data, null, 2))

    // Tratamento de "Já existe"
    if (response.status === 403 || (data.error && data.error.includes('already exists'))) {
        console.log("[DEBUG STEP 5.1] API disse que já existe. Tentando conectar...")
        return withPersist(await connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!))
    }

    if (!response.ok) {
        return { error: data.message || "Erro ao criar instância na API" }
    }

    // Sucesso direto com QR Code
    if (data.qrcode && data.qrcode.base64) {
        console.log("[DEBUG SUCCESS] QR Code recebido na criação!")
        return withPersist({
            success: true,
            qrcode: data.qrcode.base64,
            status: 'qrcode'
        })
    }
    // Sucesso, mas sem QR Code no corpo
    console.log("[DEBUG STEP 6] Instância criada, mas sem QR no corpo. Buscando separadamente...")
    return withPersist(await connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!))

  } catch (error: any) {
    console.error("[DEBUG ERROR] Erro fatal no fetch de criação:", error)
    
    if (error.name === 'AbortError' || error.cause?.code === 'ECONNRESET') {
        console.log("[DEBUG STEP 7] Timeout detectado! Tentando recuperar QR Code caso tenha criado no background...")
        await delay(2000)
        return withPersist(await connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!))
    }

    return { error: "Falha na conexão com a API (Timeout ou Rede)." }
  }
}

// --- FUNÇÃO AUXILIAR: BUSCAR QR CODE ---
async function connectWhatsappInstance(instanceName: string, url: string, key: string) {
     console.log(`[DEBUG CONNECT] Iniciando busca persistente de QR Code...`)
     
     let attempts = 0
     const maxAttempts = 10

     while (attempts < maxAttempts) {
        attempts++
        console.log(`[DEBUG CONNECT] Tentativa ${attempts}/${maxAttempts} buscando em: ${url}/instance/connect/${instanceName}`)
        
        try {
            const res = await fetch(`${url}/instance/connect/${instanceName}`, {
                headers: { 'apikey': key },
                cache: 'no-store'
            })
            
            const data = await res.json()

            // 1. SUCESSO: QR Code Chegou!
            if (data.base64) {
                console.log("[DEBUG SUCCESS] QR Code encontrado na tentativa " + attempts)
                return { success: true, qrcode: data.base64, status: 'qrcode' }
            }
            
            // 2. SUCESSO: Já conectou
            if (isEvolutionConnected(data)) {
                console.log("[DEBUG SUCCESS] Instância já conectada!")
                return {
                    success: true,
                    connected: true,
                    status: "connected",
                }
            }

            // 3. AINDA NÃO: Resposta vazia ou count:0
            console.log(`[DEBUG WAIT] Resposta foi ${JSON.stringify(data)}. Esperando 2 segundos...`)
            await delay(2000) // Espera 2s antes de tentar de novo

        } catch (e) {
             console.error("[DEBUG CONNECT ERROR]", e)
             await delay(2000)
        }
     }

     console.error("[DEBUG FAIL] Desistindo após " + maxAttempts + " tentativas.")
     return { error: "O servidor está demorando para gerar o QR Code. Atualize a página e clique em Gerar novamente." }
}

// --- DELETAR INSTÂNCIA (RESET) ---
export async function deleteWhatsappInstance() {
    console.log("[DEBUG DELETE] Iniciando reset...")
    const supabase = await createClient<Database>()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: "Não autorizado" }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations(slug, whatsapp_instance_name)')
        .eq('id', user.id)
        .single()

    const org = profile?.organizations
    if (!profile?.organization_id || !org) return { error: "Org não encontrada" }

    const instanceName = resolveInstanceName(org)
    if (!instanceName) return { error: "Org sem instância para desconectar" }

    const server = getEvolutionServer()
    if (!server) return { error: "Servidor Evolution não configurado." }

    try {
        const response = await fetch(`${server.url}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': server.apiKey }
        })

        // 404 = já não existe na Evolution; o vínculo no banco deve sumir igual.
        if (!response.ok && response.status !== 404) {
            console.error("[DEBUG DELETE] Evolution recusou o delete:", response.status)
            return { error: "Erro ao desconectar" }
        }

        // Solta o vínculo: sem instância, o envio falha explícito em vez de
        // sair por um número que não é mais da org.
        const { error: updateError } = await supabase
            .from('organizations')
            .update({ whatsapp_instance_name: null })
            .eq('id', profile.organization_id)

        if (updateError) {
            console.error("[DEBUG DELETE] Instância removida na Evolution, mas o banco não limpou:", updateError.message)
            return { error: "Instância desconectada, mas o vínculo não foi removido. Tente novamente." }
        }

        console.log("[DEBUG DELETE] Instância deletada com sucesso.")
        return { success: true }
    } catch (e) {
        console.error("[DEBUG DELETE] Falha de conexão com a Evolution:", e)
        return { error: "Erro ao desconectar" }
    }
}

// --- CHECAR STATUS ---
export async function getWhatsappStatus(): Promise<WhatsappResponse> {
  const supabase = await createClient<Database>()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "unknown" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organizations(slug, whatsapp_instance_name)")
    .eq("id", user.id)
    .single()

  const org = profile?.organizations

  if (!org) {
    return { status: "unknown" }
  }

  const instanceName = resolveInstanceName(org)

  if (!instanceName) {
    return { status: "unknown" }
  }

  const server = getEvolutionServer()

  if (!server) {
    console.error("[getWhatsappStatus] Evolution API não configurada.")
    return { status: "error" }
  }

  try {
    const response = await fetch(
      `${server.url}/instance/connectionState/${instanceName}`,
      {
        method: "GET",
        headers: {
          apikey: server.apiKey,
        },
        cache: "no-store",
      }
    )

    if (response.status === 404) {
      return { status: "disconnected" }
    }

    if (!response.ok) {
      console.error(
        "[getWhatsappStatus] Erro ao consultar status:",
        response.status,
        await response.text()
      )

      return { status: "error" }
    }

    const data = await response.json()

    if (isEvolutionConnected(data)) {
      return {
        success: true,
        connected: true,
        status: "connected",
      }
    }

    return {
      success: true,
      connected: false,
      status: "disconnected",
    }
  } catch (error) {
    console.error("[getWhatsappStatus] Falha ao consultar Evolution:", error)

    return { status: "error" }
  }
}