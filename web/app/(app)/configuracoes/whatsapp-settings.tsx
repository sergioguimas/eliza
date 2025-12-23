'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode, Smartphone, Loader2, CheckCircle2 } from "lucide-react"
import { createWhatsappInstance } from "@/app/actions/whatsapp-connect"
import { toast } from "sonner"

export function WhatsappSettings() {
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  async function handleConnect() {
    setLoading(true)
    setQrCode(null)
    
    // 👇 O SEGREDO: ": any" diz para o TypeScript não encher a paciência
    const result: any = await createWhatsappInstance()
    
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.connected) {
      setIsConnected(true)
      toast.success("WhatsApp conectado com sucesso!")
    } else if (result.qrcode) {
      setQrCode(result.qrcode)
      toast.info("Leia o QR Code para finalizar.")
    }
  }

  // ... (O resto do return do componente continua IGUAL ao anterior)
  // Vou colocar apenas o return aqui para você copiar tudo se preferir:
  
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center gap-3">
           <div className="p-2 bg-green-900/20 rounded-lg">
              <Smartphone className="h-6 w-6 text-green-500" />
           </div>
           <div>
              <CardTitle className="text-zinc-100">Integração WhatsApp</CardTitle>
              <CardDescription className="text-zinc-400">
                Conecte o WhatsApp da clínica para enviar confirmações automáticas.
              </CardDescription>
           </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
          {isConnected ? (
              <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in slide-in-from-bottom-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h3 className="text-lg font-medium text-green-400">WhatsApp Conectado!</h3>
                  <p className="text-sm text-zinc-400 max-w-xs">
                      Tudo pronto! O sistema enviará mensagens automaticamente.
                  </p>
                  <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 opacity-50 cursor-not-allowed">
                      Desconectar
                  </Button>
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center space-y-6 py-4">
                  {!qrCode ? (
                      <div className="text-center space-y-4">
                          <p className="text-sm text-zinc-400 max-w-md mx-auto">
                              Clique abaixo para gerar o código de pareamento.
                          </p>
                          <Button 
                              onClick={handleConnect} 
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
                          >
                              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                              Gerar QR Code
                          </Button>
                      </div>
                  ) : (
                      <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                           <div className="bg-white p-4 rounded-lg inline-block shadow-lg shadow-green-900/20">
                              <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64" />
                           </div>
                           <p className="text-xs text-zinc-500">
                                Abra o WhatsApp &gt; Configurações &gt; Aparelhos Conectados
                           </p>
                           <Button 
                              variant="ghost" 
                              onClick={() => setQrCode(null)}
                              className="text-zinc-500 hover:text-zinc-300"
                           >
                              Cancelar
                           </Button>
                      </div>
                  )}
              </div>
          )}
      </CardContent>
    </Card>
  )
}