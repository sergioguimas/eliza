'use server'

import { createClient } from "@/utils/supabase/server"

// Endereços da API (ajuste se seu Docker estiver diferente)
const EVOLUTION_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "http://127.0.0.1:8082"
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "medagenda123"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function createWhatsappInstance() {
  const supabase = await createClient()
  
  // 1. Quem é o usuário e qual a empresa dele?
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Usuário não autenticado" }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, organizations(slug)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id || !profile?.organizations?.slug) {
    return { error: "Você não tem uma organização vinculada." }
  }

  // O nome da instância será o slug da empresa (ex: clinica-vida)
  const instanceName = profile.organizations.slug
  const organizationId = profile.organization_id

  console.log("🚀 [Evolution API] Conectando:", instanceName)

  try {
    // 2. Criar/Conectar na Evolution API
    const createResponse = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
            instanceName: instanceName,
            token: instanceName, // Token igual ao nome para facilitar
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            reject_call: true
        })
    })

    const createData = await createResponse.json()
    
    // Ignora erro se já existir
    if (!createResponse.ok && createData?.response?.message?.[0] !== "Instance already exists") {
        console.error("Erro Evolution:", createData)
    }

    // 3. Buscar o QR Code (Loop de tentativas)
    const result = await fetchQrCodeLoop(instanceName)

    // 4. Salvar/Atualizar no Banco de Dados do Supabase
    if (result.qrcode || result.connected) {
      await supabase.from('whatsapp_instances').upsert({
        organization_id: organizationId,
        name: instanceName,
        status: result.connected ? 'connected' : 'pending',
        qr_code: result.qrcode || null
      }, { onConflict: 'organization_id' }) // Garante apenas 1 whats por empresa
    }

    return result

  } catch (error) {
    console.error("❌ Erro Crítico:", error)
    return { error: "Erro ao comunicar com o servidor do WhatsApp." }
  }
}

async function fetchQrCodeLoop(instanceName: string) {
    let attempts = 0
    const maxAttempts = 20 // Tenta por 60 segundos (20 * 3s)

    while (attempts < maxAttempts) {
        attempts++
        try {
            const response = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: { 'apikey': EVOLUTION_API_KEY }
            })
            
            const data = await response.json()

            // CASO 1: QR Code chegou!
            if (data.base64) { 
                return { success: true, qrcode: data.base64 }
            }
            
            // CASO 2: Já está conectado!
            if (data.instance?.status === 'open' || data.instance?.state === 'open') {
                return { success: true, connected: true }
            }

            // CASO 3: Ainda carregando... espera 3s
            await delay(3000)

        } catch (e) {
            await delay(3000)
        }
    }
    return { error: "Tempo esgotado. Tente novamente." }
}