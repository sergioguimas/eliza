'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { sendWhatsappMessage } from "@/app/actions/send-whatsapp"
import { toast } from "sonner"

export function WhatsappTestButton() {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleTest() {
    if (!phone) return toast.error("Digite um número")
    setLoading(true)
    
    // Tenta enviar um "Olá" simples
    const result = await sendWhatsappMessage(phone, "🤖 Olá! Teste de conexão do Eliza Agendamentos.")
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Mensagem enviada! Verifique o WhatsApp.")
    }
    setLoading(false)
  }

  return (
    <div className="flex gap-2 items-center p-4 border border-zinc-800 rounded-lg bg-zinc-900/50 mt-4">
      <Input 
        placeholder="5511999999999" 
        value={phone} 
        onChange={e => setPhone(e.target.value)}
        className="bg-zinc-950 border-zinc-800 w-40"
      />
      <Button onClick={handleTest} disabled={loading} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Testar Envio
      </Button>
    </div>
  )
}