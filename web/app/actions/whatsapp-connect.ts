'use server'

import { createClient } from "@/utils/supabase/server"

// --- TIPO PADRONIZADO PARA PARAR O ERRO DO TS ---
export type WhatsappResponse = {
  success?: boolean
  error?: string
  qrcode?: string
  connected?: boolean
  status?: string
}

// Fallbacks de segurança
const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function createWhatsappInstance(): Promise<WhatsappResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Usuário não autenticado" }

  // 1. Busca dados da Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations:organization_id(slug, evolution_api_url, evolution_api_key)')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id || !profile?.organizations?.slug) {
    return { error: "Organização não encontrada." }
  }

  const instanceName = profile.organizations.slug
  const EVOLUTION_URL = profile.organizations.evolution_api_url || DEFAULT_EVOLUTION_URL
  const API_KEY = profile.organizations.evolution_api_key || GLOBAL_API_KEY

  if (!EVOLUTION_URL) return { error: "URL da API não configurada." }
  
  console.log(`🔌 Conectando instância: ${instanceName}`)

  try {
    // 2. Tenta CRIAR a instância
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)
    const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY! },
        body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        }),
        signal: controller.signal
    })

    const createData = await createResponse.json()
    clearTimeout(timeoutId)
    
    // Detecção robusta se "Já Existe"
    let isAlreadyExists = false
    const msg = JSON.stringify(createData).toLowerCase()
    if (msg.includes("already in use") || msg.includes("already exists")) {
      isAlreadyExists = true
    }

    if (!createResponse.ok && !isAlreadyExists) {
        console.error("Erro Evolution:", createData)
        return { error: "Erro ao criar instância na API." }
    }

    // 3. Se já existe ou acabou de criar, busca o QR Code
    const result = await fetchQrCodeLoop(instanceName, EVOLUTION_URL, API_KEY!)

    return result

  } catch (error: any) {
    console.error("❌ Erro Crítico:", error)
    return { error: `Falha de conexão: ${error.message}` }
  }
}

// Função Auxiliar de Loop
async function fetchQrCodeLoop(instanceName: string, url: string, apiKey: string): Promise<WhatsappResponse> {
    let attempts = 0
    const maxAttempts = 10 

    while (attempts < maxAttempts) {
        attempts++
        try {
            const response = await fetch(`${url}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: { 'apikey': apiKey }
            })
            
            const data = await response.json()

            // Caso 1: Retorna QR Code (Base64)
            if (data.base64 || data.qrcode?.base64) { 
                return { success: true, qrcode: data.base64 || data.qrcode?.base64 }
            }
            
            // Caso 2: Já conectado
            const state = data.instance?.state || data.instance?.status
            if (state === 'open' || state === 'connected') {
                return { success: true, connected: true }
            }
            
            await delay(1500) 
        } catch (e) {
            await delay(1000)
        }
    }
    return { error: "Tempo esgotado. Tente clicar novamente." }
}

// 4. Função para Desconectar
export async function deleteWhatsappInstance(): Promise<WhatsappResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Auth required" }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations:organization_id(slug, evolution_api_url, evolution_api_key)')
        .eq('id', user.id)
        .single() as any
        
    const instanceName = profile?.organizations?.slug
    const EVOLUTION_URL = profile?.organizations?.evolution_api_url || DEFAULT_EVOLUTION_URL
    const API_KEY = profile?.organizations?.evolution_api_key || GLOBAL_API_KEY
    
    if(instanceName && EVOLUTION_URL) {
        try {
            await fetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
                method: 'DELETE', headers: { 'apikey': API_KEY! }
            })
            return { success: true }
        } catch (e) { 
            return { error: "Erro ao desconectar" }
        }
    }
    return { error: "Dados inválidos" }
}

// 5. Verifica Status (Para rodar ao carregar a página)
export async function getWhatsappStatus(): Promise<WhatsappResponse> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { status: 'unknown' }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organizations(slug, evolution_api_url, evolution_api_key)')
        .eq('id', user.id)
        .single() as any
    
    const org = profile?.organizations
    if (!org) return { status: 'unknown' }

    const instanceName = org.slug
    const EVOLUTION_URL = org.evolution_api_url || DEFAULT_EVOLUTION_URL
    const API_KEY = org.evolution_api_key || GLOBAL_API_KEY

    try {
        const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': API_KEY! },
            cache: 'no-store'
        })
        
        if(response.status === 404) return { status: 'disconnected' } 
        
        const data = await response.json()
        const state = data.instance?.state || 'disconnected'
        return { status: state === 'open' ? 'connected' : 'disconnected' }
    } catch (e) {
        return { status: 'error' }
    }
}