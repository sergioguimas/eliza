'use server'

import { createClient } from "@/utils/supabase/server"
import { Database } from "@/utils/database.types"

// --- TIPAGEM ---
export type WhatsappResponse = {
  success?: boolean
  error?: string
  qrcode?: string
  connected?: boolean
  status?: string
}

const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY

// Helper para esperar (usado no fallback)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
    .select('organization_id, organizations:organization_id(slug, evolution_api_url, evolution_api_key)')
    .eq('id', user.id)
    .single()

  if (!profile?.organizations?.slug) {
    console.error("[DEBUG ERROR] Organização não encontrada para o usuário")
    return { error: "Organização não encontrada." }
  }

  const instanceName = profile.organizations.slug
  // Prioridade: Banco de dados > Variável de Ambiente
  const EVOLUTION_URL = profile.organizations.evolution_api_url || process.env.NEXT_PUBLIC_EVOLUTION_API_URL
  const API_KEY = profile.organizations.evolution_api_key || process.env.EVOLUTION_API_KEY

  console.log(`[DEBUG STEP 2] Configuração definida:`)
  console.log(`- Instance Name: ${instanceName}`)
  console.log(`- URL Alvo: ${EVOLUTION_URL}`)
  console.log(`- API Key (final): ${API_KEY ? '***' + API_KEY.slice(-3) : 'NÃO DEFINIDA'}`)

  if (!EVOLUTION_URL) return { error: "URL da API não configurada" }

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
          return connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!)
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
        return connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!)
    }

    if (!response.ok) {
        return { error: data.message || "Erro ao criar instância na API" }
    }

    // Sucesso direto com QR Code
    if (data.qrcode && data.qrcode.base64) {
        console.log("[DEBUG SUCCESS] QR Code recebido na criação!")
        return { 
            success: true, 
            qrcode: data.qrcode.base64,
            status: 'qrcode'
        }
    }
    // Sucesso, mas sem QR Code no corpo
    console.log("[DEBUG STEP 6] Instância criada, mas sem QR no corpo. Buscando separadamente...")
    return connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!)

  } catch (error: any) {
    console.error("[DEBUG ERROR] Erro fatal no fetch de criação:", error)
    
    if (error.name === 'AbortError' || error.cause?.code === 'ECONNRESET') {
        console.log("[DEBUG STEP 7] Timeout detectado! Tentando recuperar QR Code caso tenha criado no background...")
        await delay(2000)
        return connectWhatsappInstance(instanceName, EVOLUTION_URL, API_KEY!)
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
            if (data.instance && data.instance.state === 'open') {
                 console.log("[DEBUG SUCCESS] Instância já conectada!")
                 return { success: true, status: 'connected' }
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { error: "Não autorizado" }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organizations(slug, evolution_api_url, evolution_api_key)')
        .eq('id', user.id)
        .single()

    const org = profile?.organizations
    if (!org) return { error: "Org não encontrada" }

    const instanceName = org.slug
    const EVOLUTION_URL = org.evolution_api_url || process.env.NEXT_PUBLIC_EVOLUTION_API_URL
    const API_KEY = org.evolution_api_key || GLOBAL_API_KEY

    try {
        await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE',
            headers: { 'apikey': API_KEY! }
        })
        console.log("[DEBUG DELETE] Instância deletada com sucesso.")
        return { success: true }
    } catch (e) { 
        return { error: "Erro ao desconectar" }
    }
}

// --- CHECAR STATUS ---
export async function getWhatsappStatus(): Promise<WhatsappResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: 'unknown' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organizations(slug, evolution_api_url, evolution_api_key)')
        .eq('id', user.id)
        .single()
    
    const org = profile?.organizations
    if (!org) return { status: 'unknown' }

    const instanceName = org.slug
    const EVOLUTION_URL = org.evolution_api_url || process.env.NEXT_PUBLIC_EVOLUTION_API_URL
    const API_KEY = org.evolution_api_key || process.env.EVOLUTION_API_KEY

    try {
        const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': API_KEY! },
            cache: 'no-store'
        })
        
        if(response.status === 404) return { status: 'disconnected' } 
        
        const data = await response.json()
        
        if (data.instance && data.instance.state === 'open') {
            return { status: 'connected' }
        }
        
        if (data.instance && data.instance.state === 'connecting') {
             return { status: 'disconnected' }
        }

        return { status: 'disconnected' }
    } catch (error) {
        return { status: 'error' }
    }
}