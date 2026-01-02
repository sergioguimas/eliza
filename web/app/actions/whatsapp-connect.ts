'use server'

import { createClient } from "@/utils/supabase/server"

const EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://127.0.0.1:8082"
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function createWhatsappInstance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: "Usuário não autenticado" }
  
  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .select(`
      organizations_id, 
      organizations:organizations_id (
        id,
        slug, 
        evolution_url, 
        evolution_apikey
      )
    `)
    .eq('id', user.id)
    .single() as any

  // LOG DE DEBUG: Verifique no terminal o que aparece aqui
  console.log("🔍 Perfil encontrado:", profile)

  if (dbError || !profile?.organizations_id) {
    return { error: "Vínculo com a organização não encontrado no seu perfil." }
  }

  if (!profile.organizations?.slug) {
    return { error: "A clínica foi encontrada, mas o identificador (slug) está vazio." }
  }

const instanceName = profile.organizations.slug
const organizationId = profile.organizations_id
const url = profile.organizations.evolution_url || EVOLUTION_URL
const apiKey = profile.organizations.evolution_apikey || EVOLUTION_API_KEY

  console.log("🚀 [Evolution v2.3.6] Iniciando Monster Instance:", instanceName)

  try {
    // 1. Criar Instância
    const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
            instanceName: instanceName,
            token: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            reject_call: true,
            
            // --- CONFIGURAÇÃO OTIMIZADA V2.3.6 ---
            groupsIgnore: true,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: false, // O segredo da velocidade
            
            // Navegador Padrão (Deixe a API gerenciar a versão interna via Docker)
            browser: ["Chrome (Linux)", "Chrome", "110.0.5481.177"]
        })
    })

    const createData = await createResponse.json()
    
    // Log para debug
    if (!createResponse.ok && createData?.response?.message?.[0] !== "Instance already exists") {
        console.log("⚠️ Status Criação:", createData)
    }

    // 2. Deleta registro antigo no banco para garantir status limpo
    await supabase.from('whatsapp_instances')
        .delete()
        .eq('organization_id', organizationId)

    // 3. Buscar QR Code
    const result = await fetchQrCodeLoop(instanceName)

    // 4. Salvar Novo Status
    if (result.qrcode || result.connected) {
      await updateInstanceSettings(instanceName)
      await supabase.from('whatsapp_instances').insert({
        organization_id: organizationId as string,
        name: instanceName,
        status: result.connected ? 'connected' : 'pending',
        qr_code: result.qrcode || null
      })
    }

    return result

  } catch (error) {
    console.error("❌ Erro Crítico:", error)
    return { error: "Erro de conexão com API" }
  }
}

// ... (Mantenha as funções fetchQrCodeLoop e deleteWhatsappInstance iguais)
async function fetchQrCodeLoop(instanceName: string) {
    let attempts = 0
    const maxAttempts = 20 

    while (attempts < maxAttempts) {
        attempts++
        try {
            const response = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: { 'apikey': EVOLUTION_API_KEY }
            })
            
            const data = await response.json()

            if (data.base64) { 
                return { success: true, qrcode: data.base64 }
            }
            
            if (data.instance?.status === 'open' || data.instance?.state === 'open') {
                return { success: true, connected: true }
            }
            
            await delay(3000)
        } catch (e) {
            await delay(3000)
        }
    }
    return { error: "Tempo esgotado. Tente novamente." }
}

export async function deleteWhatsappInstance() {
    // ... (mesmo código de antes para deletar)
    // Se não tiver o código fácil, eu mando de novo, mas acho que você já tem.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Auth required" }
    
    const { data: profile } = await supabase.from('profiles').select('organizations(slug)').eq('id', user.id).single()
    const instanceName = profile?.organizations?.slug
    
    if(instanceName) {
        await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
            method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
        })
        await supabase.from('whatsapp_instances').delete().eq('name', instanceName)
    }
    return { success: true }
}

// Função para forçar as configurações de ignorar após conectar
async function updateInstanceSettings(instanceName: string) {
    try {
        await fetch(`${EVOLUTION_URL}/instance/settings/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                "reject_call": true,
                "groupsIgnore": true,
                "alwaysOnline": false,
                "readMessages": false,
                "readStatus": false,
                "syncFullHistory": false
            })
        })
        console.log("⚙️ Configurações de ignorar reforçadas com sucesso!")
    } catch (error) {
        console.error("Erro ao atualizar settings:", error)
    }
}