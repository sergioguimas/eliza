'use server'

import { createClient } from "@/utils/supabase/server"

// URLs e Chaves Padrão (Fallback)
const DEFAULT_EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://127.0.0.1:8082"
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY || "medagenda123"

// URL PÚBLICA (Ngrok/Vercel) para o Webhook
// Importante: Defina NEXT_PUBLIC_APP_URL no seu .env.local com a url do Ngrok atual!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function createWhatsappInstance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }

  // CORREÇÃO: Usando 'organization_id' (singular) conforme novo Schema
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations:organization_id(slug, evolution_url, evolution_api_key)')
    .eq('id', user.id)
    .single() as any

  if (!profile?.organization_id || !profile?.organizations?.slug) {
    return { error: "Organização não encontrada ou Slug vazio." }
  }

  const instanceName = profile.organizations.slug
  const organizationId = profile.organization_id
  
  // Usa a config do banco ou o padrão do ambiente
  const EVOLUTION_URL = profile.organizations.evolution_url || DEFAULT_EVOLUTION_URL
  const API_KEY = profile.organizations.evolution_api_key || GLOBAL_API_KEY
  
  // Monta a URL do Webhook dinamicamente
  const webhookUrl = `${APP_URL}/api/whatsapp`

  console.log(`🔌 Tentando criar instância: ${instanceName} na URL: ${EVOLUTION_URL}`)
  console.log(`🪝 Webhook configurado para: ${webhookUrl}`)

  try {
    // 1. Cria a Instância
    const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY
        },
        body: JSON.stringify({
            instanceName: instanceName,
            token: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: webhookUrl, 
            webhook_by_events: true,
            events: ["CONNECTION_UPDATE"], // Só queremos saber quando conecta/desconecta
            reject_call: true,
            groupsIgnore: true,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false
        })
    })

    const createData = await createResponse.json()
    
    // Se já existe, tudo bem, seguimos para buscar o QR Code
    if (!createResponse.ok && createData?.error && !createData.error.includes("already exists")) {
        console.error("Erro ao criar instância:", createData)
        return { error: "Falha ao criar instância na Evolution API" }
    }

    // 2. Limpa registro antigo no Supabase para evitar lixo
    await supabase.from('whatsapp_instances')
        .delete()
        .eq('organization_id', organizationId)

    // 3. Busca o QR Code (Loop de tentativas)
    const result = await fetchQrCodeLoop(instanceName, EVOLUTION_URL, API_KEY)

    // 4. Salva o estado inicial no Banco
    if (result.qrcode || result.connected) {
      // Garante configurações de privacidade
      await updateInstanceSettings(instanceName, EVOLUTION_URL, API_KEY)
      
      await supabase.from('whatsapp_instances').insert({
        organization_id: organizationId,
        name: instanceName,
        status: result.connected ? 'connected' : 'pending',
        qr_code: result.qrcode || null
      })
    }

    return result

  } catch (error) {
    console.error("❌ Erro Crítico de Conexão:", error)
    return { error: "Não foi possível conectar com a Evolution API. Verifique se ela está rodando." }
  }
}

async function fetchQrCodeLoop(instanceName: string, url: string, apiKey: string) {
    let attempts = 0
    const maxAttempts = 10 // Reduzi para não travar muito tempo

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
            
            await delay(2000)
        } catch (e) {
            console.log(`Tentativa ${attempts} falhou, tentando novamente...`)
            await delay(2000)
        }
    }
    return { error: "Tempo esgotado. Tente recarregar a página." }
}

export async function deleteWhatsappInstance() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Auth required" }
    
    // CORREÇÃO: organization_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, organizations:organization_id(slug, evolution_url, evolution_api_key)')
        .eq('id', user.id)
        .single() as any
        
    const instanceName = profile?.organizations?.slug
    const EVOLUTION_URL = profile?.organizations?.evolution_url || DEFAULT_EVOLUTION_URL
    const API_KEY = profile?.organizations?.evolution_api_key || GLOBAL_API_KEY
    
    if(instanceName) {
        try {
            await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
                method: 'DELETE', headers: { 'apikey': API_KEY }
            })
        } catch (e) { console.error("Erro ao deletar na API (pode já não existir)") }

        await supabase.from('whatsapp_instances').delete().eq('name', instanceName)
    }
    return { success: true }
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
                "alwaysOnline": false,
                "readMessages": false,
                "readStatus": false
            })
        })
    } catch (error) {
        console.error("Erro ao atualizar settings:", error)
    }
}