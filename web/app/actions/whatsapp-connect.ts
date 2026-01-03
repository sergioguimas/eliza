'use server'

import { createClient } from "@/utils/supabase/server"

// Configurações Padrão
const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://127.0.0.1:8082"
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY || "medagenda123"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function createWhatsappInstance() {
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
    return { error: "Organização não encontrada ou Slug vazio." }
  }

  const instanceName = profile.organizations.slug
  const organizationId = profile.organization_id
  
  const EVOLUTION_URL = profile.organizations.evolution_api_url || DEFAULT_EVOLUTION_URL
  const API_KEY = profile.organizations.evolution_api_key || GLOBAL_API_KEY
  
  console.log(`🔌 Criando instância: ${instanceName} em ${EVOLUTION_URL}`)

  try {
    // 2. CRIAÇÃO SIMPLIFICADA (Payload Mínimo para evitar erros de validação)
    const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
        },
        body: JSON.stringify({
            instanceName: instanceName,
            token: instanceName,
            qrcode: true
        })
    })

    const createData = await createResponse.json()
    
    // Ignora erro se a instância já existir
    if (!createResponse.ok && createData?.error && !createData.message?.includes("already exists") && !createData.error?.includes("already exists")) {
        console.error("Erro Evolution:", createData)
        return { error: `Erro na API: ${JSON.stringify(createData.response || createData)}` }
    }

    // 3. Limpa instância antiga do banco
    await supabase.from('whatsapp_instances')
        .delete()
        .eq('organization_id', organizationId)

    // 4. Configura Comportamento
    await updateInstanceSettings(instanceName, EVOLUTION_URL, API_KEY)

    // 5. Busca o QR Code (Loop de tentativas)
    const result = await fetchQrCodeLoop(instanceName, EVOLUTION_URL, API_KEY)

    // 6. Salva no Banco de Dados
    if (result.qrcode || result.connected) {
      const { error: dbError } = await supabase.from('whatsapp_instances').insert({
        organization_id: organizationId,
        name: instanceName,
        status: result.connected ? 'connected' : 'pending',
        qr_code: result.qrcode || null,
        updated_at: new Date().toISOString()
      })
      
      if (dbError) console.error("Erro ao salvar no banco:", dbError)
    }

    return result

  } catch (error: any) {
    console.error("❌ Erro Crítico de Conexão:", error)
    return { error: `Falha de conexão: ${error.message}` }
  }
}

async function fetchQrCodeLoop(instanceName: string, url: string, apiKey: string) {
    let attempts = 0
    const maxAttempts = 5 

    while (attempts < maxAttempts) {
        attempts++
        try {
            const response = await fetch(`${url}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: { 'apikey': apiKey }
            })
            
            const data = await response.json()

            // Sucesso: Retorna QR Code
            if (data.base64) { 
                return { success: true, qrcode: data.base64 }
            }
            
            // Sucesso: Já conectado
            if (data.instance?.status === 'open' || data.instance?.state === 'open') {
                return { success: true, connected: true }
            }
            
            await delay(1500)
        } catch (e) {
            console.log(`Tentativa ${attempts} falhou, tentando novamente...`)
            await delay(1500)
        }
    }
    return { error: "Instância criada, mas QR Code demorou. Tente clicar em 'Atualizar' em instantes." }
}

async function updateInstanceSettings(instanceName: string, url: string, apiKey: string) {
    try {
        await fetch(`${url}/instance/settings/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify({
                "reject_call": true,
                "groupsIgnore": true,
                "alwaysOnline": true, 
                "readMessages": false,
                "readStatus": false
            })
        })
    } catch (error) {
        console.error("Erro não-crítico ao atualizar settings:", error)
    }
}

export async function deleteWhatsappInstance() {
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
    
    if(instanceName) {
        try {
            await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
                method: 'DELETE', headers: { 'apikey': API_KEY }
            })
            // (Logout)
            await fetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
                method: 'DELETE', headers: { 'apikey': API_KEY }
            })
        } catch (e) { console.error("Erro ao deletar na API") }

        await supabase.from('whatsapp_instances').delete().eq('name', instanceName)
    }
    return { success: true }
}