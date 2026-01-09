'use client'

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { updateSettings } from "@/app/actions/update-settings"
import { toast } from "sonner"
import { Loader2, ArrowRight, ArrowLeft, Check, Building2, MapPin } from "lucide-react"
import { useRouter } from "next/navigation"

export function SetupForm({ organization }: { organization: any }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  
  // Controle de Passos (0 = Dados Básicos, 1 = Endereço/Contato)
  const [step, setStep] = useState(0)

  // Estado Local para segurar os dados entre os passos
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    document: organization?.document || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    address: organization?.address || ''
  })

  // Atualiza o estado conforme o usuário digita
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Envio Final (Só acontece no último passo)
  const handleFinish = async () => {
    startTransition(async () => {
      // Converte nosso objeto state para FormData (formato que a Server Action espera)
      const dataToSend = new FormData()
      dataToSend.append('org_id', organization.id)
      
      Object.entries(formData).forEach(([key, value]) => {
        dataToSend.append(key, value)
      })

      const result = await updateSettings(dataToSend)

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Setup concluído com sucesso!")
        // Força o redirecionamento para o dashboard
        router.push('/dashboard') 
        router.refresh()
      }
    })
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Indicador de Progresso Visual */}
      <div className="flex items-center justify-center mb-8 space-x-4">
        <div className={`flex items-center space-x-2 ${step >= 0 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>1</div>
          <span className="font-medium">Empresa</span>
        </div>
        <div className="w-12 h-0.5 bg-border" />
        <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>2</div>
          <span className="font-medium">Localização</span>
        </div>
      </div>

      <Card className="border-border bg-card shadow-lg">
        {/* === PASSO 1: DADOS BÁSICOS === */}
        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5"/> Dados da Clínica</CardTitle>
              <CardDescription>Comece informando os dados principais da sua organização.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Clínica <span className="text-red-500">*</span></Label>
                <Input 
                  id="name" name="name" 
                  value={formData.name} onChange={handleChange} 
                  placeholder="Ex: Clínica Saúde Vida" 
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document">CPF ou CNPJ</Label>
                <Input 
                  id="document" name="document" 
                  value={formData.document} onChange={handleChange} 
                  placeholder="00.000.000/0000-00" 
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
              <Button onClick={() => setStep(1)} disabled={!formData.name}>
                Próximo <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </div>
        )}

        {/* === PASSO 2: CONTATO E ENDEREÇO === */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5"/> Contato & Endereço</CardTitle>
              <CardDescription>Como seus pacientes podem te encontrar?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input 
                    id="phone" name="phone" 
                    value={formData.phone} onChange={handleChange} 
                    placeholder="(00) 00000-0000" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Público</Label>
                  <Input 
                    id="email" name="email" 
                    value={formData.email} onChange={handleChange} 
                    placeholder="contato@clinica.com" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <Textarea 
                  id="address" name="address" 
                  value={formData.address} onChange={handleChange} 
                  placeholder="Rua, Número, Bairro, Cidade - UF" 
                  rows={3}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
              </Button>
              
              <Button onClick={handleFinish} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Finalizar Setup
              </Button>
            </CardFooter>
          </div>
        )}
      </Card>
    </div>
  )
}