'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { QrCode, Link, LogOut, Loader2, Smartphone, RefreshCw, Copy, ShieldCheck, Server, LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { createWhatsappInstance, deleteWhatsappInstance, getWhatsappStatus } from "@/app/actions/whatsapp-connect"
import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function WhatsappSettings({ settings, organizationId }: any) {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
      const result = await getWhatsappStatus()
      if (result.status === 'connected') {
          setStatus('connected')
          setQrCode(null)
      } else {
          setStatus('disconnected')
      }
  }

  async function handleConnect() {
    setIsLoading(true)
    setQrCode(null)

    const result = await createWhatsappInstance()
    
    setIsLoading(false)

    if (result.error) {
        toast.error(result.error)
        return
    }

    if (result.connected) {
        setStatus('connected')
        toast.success("WhatsApp já conectado!")
    } else if (result.qrcode) {
        setQrCode(result.qrcode)
        toast.success("QR Code gerado com sucesso!")
    }
  }

  async function handleLogout() {
    if(!confirm("Deseja desconectar o WhatsApp?")) return
    
    setIsLoading(true)
    await deleteWhatsappInstance()
    
    setTimeout(() => {
        setIsLoading(false)
        setStatus('disconnected')
        setQrCode(null)
        toast.success("Desconectado.")
    }, 2000)
  }

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text)
      toast.success("Copiado para a área de transferência")
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span>Conexão WhatsApp</span>
            </div>
            {status === 'connected' && <Badge className="bg-green-600 hover:bg-green-700">Online</Badge>}
            {status === 'disconnected' && <Badge variant="outline" className="text-muted-foreground">Offline</Badge>}
        </CardTitle>
        <CardDescription>
          Gerencie a conexão do robô de agendamentos da clínica.
        </CardDescription>
      </CardHeader>
      <CardContent>
        
        <div className="bg-muted/20 border border-border rounded-xl p-8 flex flex-col items-center justify-center min-h-[350px] gap-6 relative overflow-hidden">
            
            {/* CASO 1: LOADING GERAL */}
            {status === 'loading' && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Verificando status...</p>
                </div>
            )}

            {/* CASO 2: CONECTADO */}
            {status === 'connected' && (
                <div className="text-center space-y-6 animate-in fade-in zoom-in duration-300 z-10">
                    <div className="h-24 w-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm ring-1 ring-green-500/20">
                        <Link className="h-10 w-10" />
                    </div>
                    <div>
                        <h3 className="font-bold text-xl">WhatsApp Conectado!</h3>
                        <p className="text-muted-foreground max-w-xs mx-auto mt-2 text-sm">
                            O sistema está pronto para enviar lembretes e responder clientes automaticamente.
                        </p>
                    </div>
                    <Button variant="destructive" onClick={handleLogout} disabled={isLoading}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Desconectar
                    </Button>
                </div>
            )}

            {/* CASO 3: MOSTRANDO QR CODE */}
            {status === 'disconnected' && qrCode && (
                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-md">
                    
                    {/* Caixa Branca Específica para o QR Code (Necessário para leitura) */}
                    <div className="bg-white p-4 rounded-xl shadow-lg border-4 border-white">
                        <img src={qrCode} alt="QR Code" className="h-64 w-64 object-contain" />
                    </div>
                    
                    <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground animate-pulse">
                            Abra o WhatsApp no celular &gt; Aparelhos Conectados &gt; Conectar
                        </p>
                        
                        <div className="flex gap-3 justify-center">
                             <Button variant="ghost" onClick={() => setQrCode(null)} disabled={isLoading}>
                                Cancelar
                             </Button>
                             <Button onClick={checkStatus} disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Já escaneei
                             </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CASO 4: DESCONECTADO (Estado Inicial) */}
            {status === 'disconnected' && !qrCode && (
                <div className="text-center space-y-6 z-10">
                    <div className="relative mx-auto w-fit">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center border border-border">
                            <QrCode className="h-10 w-10 text-muted-foreground" />
                        </div>
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-full">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-lg">Conectar Novo Número</h3>
                        <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2">
                            Clique no botão abaixo para gerar um QR Code e vincular o WhatsApp da clínica.
                        </p>
                    </div>

                    <Button size="lg" onClick={handleConnect} disabled={isLoading}>
                        {isLoading ? "Gerando..." : "Gerar QR Code"}
                    </Button>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  )
}