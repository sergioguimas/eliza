'use server'

const BASE_URL = process.env.NEXT_PUBLIC_EVOLUTION_URL
const API_KEY = process.env.EVOLUTION_API_KEY

if (!BASE_URL || !API_KEY) {
  throw new Error("Evolution API URL ou Key não configuradas no .env")
}

// Cabeçalho padrão para todas as requisições
const headers = {
  'Content-Type': 'application/json',
  'apikey': API_KEY
}

export async function createInstance(instanceName: string) {
  try {
    // 1. Tenta criar a instância
    const res = await fetch(`${BASE_URL}/instance/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instanceName: instanceName,
        token: Math.random().toString(36).substring(7), // Token aleatório de segurança
        qrcode: true, // Já pede para devolver o QR Code na resposta se possível
      })
    })

    const data = await res.json()
    
    // Se a instância já existir, a API retorna erro 403 ou aviso.
    // Nesse caso, tentamos apenas buscar o status/QR code dela.
    if (res.status === 403 || data?.error?.includes('already exists')) {
        return connectInstance(instanceName)
    }

    return data
  } catch (error) {
    console.error("Erro ao criar instância:", error)
    return null
  }
}

export async function connectInstance(instanceName: string) {
  // Pede o QR Code para conexão
  const res = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers
  })
  return await res.json()
}

export async function deleteInstance(instanceName: string) {
  // Para resetar a conexão
  await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers
  })
}

export async function getInstanceStatus(instanceName: string) {
    // Verifica se está conectado
    try {
        const res = await fetch(`${BASE_URL}/instance/connectionState/${instanceName}`, {
            method: 'GET',
            headers
        })
        return await res.json()
    } catch (e) {
        return { instance: { state: 'close' } }
    }
}