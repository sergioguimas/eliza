'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, QrCode, CheckCircle2, RefreshCw, Smartphone } from "lucide-react"
import { createWhatsappInstance } from "@/app/actions/whatsapp-connect"
import { toast } from "sonner"

interface WhatsappSettingsProps {
  initialStatus?: string | null
}

export function WhatsappSettings({ initialStatus }: WhatsappSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(initialStatus === 'connected')

  // Sincroniza o estado local se o status mudar no servidor (via Webhook/Refresh)
  useEffect(() => {
    if (initialStatus === 'connected') {
      setIsConnected(true)
      setQrCode(null)
    } else if (initialStatus === 'disconnected') {
      setIsConnected(false)
    }
  }, [initialStatus])

  async function handleConnect() {
    setLoading(true)
    setQrCode(null)
    
    try {
      const result = await createWhatsappInstance()

      // 1. Verificamos primeiro se existe um erro retornado
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }

      // 2. Usamos a asserção 'as any' ou verificamos as propriedades específicas
      const data = result as any 

      if (data.connected) {
        setIsConnected(true)
        setQrCode(null)
        toast.success("WhatsApp conectado com sucesso!")
      } else if (data.qrcode) {
        setQrCode(data.qrcode)
        toast.info("Escaneie o QR Code para conectar.")
      }
    } catch (error) {
      toast.error("Erro ao tentar conectar com a Evolution API.")
    } finally {
      setLoading(false)
    }
  }

  // Função para resetar a visão caso a conexão trave
  function handleReset() {
    setQrCode(null)
    setIsConnected(false)
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800 overflow-hidden">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
              <Smartphone className={`h-5 w-5 ${isConnected ? 'text-emerald-500' : 'text-blue-500'}`} />
            </div>
            <div>
              <CardTitle className="text-zinc-100">Integração WhatsApp</CardTitle>
              <CardDescription className="text-zinc-400">
                Conecte o WhatsApp da clínica para enviar confirmações automáticas.
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-emerald-600 hover:bg-emerald-600" : "bg-zinc-800"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[240px] space-y-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm text-zinc-400">Comunicando com a Evolution API...</p>
          </div>
        ) : isConnected ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-zinc-100 font-medium">Conexão Ativa</h3>
              <p className="text-sm text-zinc-400 max-w-[280px]">
                Sua instância está pronta para enviar mensagens automáticas.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnect} className="border-zinc-800 text-zinc-400 hover:text-zinc-100">
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Status
            </Button>
          </div>
        ) : qrCode ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-xl">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
            </div>
            <p className="text-sm text-zinc-400 text-center max-w-[250px]">
              Abra o WhatsApp {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho.
            </p>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-zinc-500 hover:text-zinc-300">
              Cancelar e tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-4">
            <p className="text-sm text-zinc-400 text-center max-w-[300px]">
              O sistema irá gerar uma instância exclusiva para sua clínica dentro da Evolution API.
            </p>
            <Button onClick={handleConnect} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 px-8">
              <QrCode className="h-5 w-5" /> Gerar QR Code
            </Button>
            <button type="button" onClick={handleReset} className="text-xs text-zinc-600 hover:text-zinc-400 underline">
              Resetar conexão travada
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}