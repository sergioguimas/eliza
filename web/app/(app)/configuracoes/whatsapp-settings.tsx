'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode, Smartphone, Loader2, CheckCircle2, RefreshCw } from "lucide-react"
import { createWhatsappInstance } from "@/app/actions/whatsapp-connect" 
import { toast } from "sonner"

export function WhatsappSettings() {
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  async function handleConnect() {
    setLoading(true)
    setQrCode(null) 
    
    try {
      // CORREÇÃO AQUI: Adicionamos 'as any' para o TypeScript não reclamar dos tipos de retorno
      const result = await createWhatsappInstance() as any

      // Se tiver erro, para aqui
      if (result.error) {
        toast.error(result.error)
        setLoading(false)
        return
      }

      // Agora o TS deixa acessar .connected e .qrcode sem reclamar
      if (result.connected) {
        setIsConnected(true)
        setQrCode(null)
        toast.success("WhatsApp conectado e sincronizado!")
      } 
      else if (result.qrcode) {
        setQrCode(result.qrcode)
        setIsConnected(false)
        toast.info("Aponte a câmera do celular para conectar.")
      }

    } catch (error) {
      toast.error("Erro inesperado ao tentar conectar.")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  
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
          
          {/* ESTADO: CONECTADO */}
          {isConnected ? (
              <div className="bg-green-950/30 border border-green-900/50 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in duration-300">
                  <div className="bg-green-500/10 p-3 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-green-400">WhatsApp Conectado!</h3>
                    <p className="text-sm text-zinc-400 max-w-xs mx-auto mt-1">
                        Sua clínica está pronta para enviar mensagens.
                    </p>
                  </div>
                  <Button variant="outline" className="border-zinc-700 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-400 opacity-50 cursor-not-allowed mt-2">
                      Desconectar
                  </Button>
              </div>
          ) : (
              /* ESTADO: DESCONECTADO OU QR CODE */
              <div className="flex flex-col items-center justify-center space-y-6 py-4">
                  
                  {!qrCode ? (
                      /* Botão Inicial */
                      <div className="text-center space-y-4">
                          <p className="text-sm text-zinc-400 max-w-md mx-auto">
                              O sistema irá gerar uma instância exclusiva para sua clínica.
                          </p>
                          <Button 
                              onClick={handleConnect} 
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700 text-white min-w-[200px] shadow-lg shadow-green-900/20 transition-all"
                          >
                              {loading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Conectando...
                                </>
                              ) : (
                                <>
                                  <QrCode className="mr-2 h-4 w-4" />
                                  Gerar QR Code
                                </>
                              )}
                          </Button>
                      </div>
                  ) : (
                      /* Exibição do QR Code */
                      <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                           <div className="bg-white p-4 rounded-xl inline-block shadow-xl shadow-green-900/10 border-4 border-white">
                              {/* O QR Code da Evolution já vem em formato Data URL base64 */}
                              <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                           </div>
                           
                           <div className="space-y-1">
                             <p className="text-sm font-medium text-zinc-300">
                                  Abra o WhatsApp &gt; Configurações &gt; Aparelhos Conectados
                             </p>
                             <p className="text-xs text-zinc-500">
                                O código expira em breve.
                             </p>
                           </div>

                           <div className="flex gap-3 justify-center pt-2">
                             <Button 
                                variant="ghost" 
                                onClick={() => setQrCode(null)}
                                className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                             >
                                Cancelar
                             </Button>
                             <Button 
                                variant="secondary" 
                                onClick={handleConnect}
                                disabled={loading}
                                className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                             >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Atualizar Código
                             </Button>
                           </div>
                      </div>
                  )}
              </div>
          )}
      </CardContent>
    </Card>
  )
}