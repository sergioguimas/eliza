'use client'

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Loader2, 
  ArrowRight, 
  ArrowLeft, 
  Check 
} from "lucide-react"
import { cn } from "@/lib/utils"

// Importações do nosso sistema
import { updateSettings } from "@/app/actions/update-settings"
import { getNicheOptions, nicheConfig } from "@/lib/niche-config"

export function SetupForm({ organization }: { organization: any }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  
  // Controle de Passos (0 = Nicho, 1 = Dados, 2 = Localização)
  const [step, setStep] = useState(0)

  // Carrega as opções do arquivo de configuração
  const nicheOptions = getNicheOptions()

  // Estado dos Dados do Formulário
  const [formData, setFormData] = useState({
    niche: organization?.niche || 'generico',
    name: organization?.name || '',
    document: organization?.document || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    address: organization?.address || ''
  })

  // Helper para pegar o label do nicho atual (Ex: "Barbearia") para usar nos textos
  const currentNicheLabel = nicheConfig[formData.niche]?.label.split('/')[0] || 'Empresa'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFinish = async () => {
    startTransition(async () => {
      const dataToSend = new FormData()
      dataToSend.append('org_id', organization.id)
      
      // Adiciona todos os campos no FormData
      Object.entries(formData).forEach(([key, value]) => {
        dataToSend.append(key, value)
      })

      const result = await updateSettings(dataToSend)

      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Setup concluído! Bem-vindo.")
        router.push('/dashboard') 
        router.refresh()
      }
    })
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Indicador de Progresso (Bolinhas 1, 2, 3) */}
      <div className="flex items-center justify-center mb-8 space-x-2 sm:space-x-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center">
             <div className={cn(
               "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
               step >= i ? "border-primary bg-primary text-primary-foreground" : "border-muted text-muted-foreground"
             )}>
               {i + 1}
             </div>
             {i < 2 && <div className={cn("w-8 sm:w-16 h-0.5 mx-2", step > i ? "bg-primary" : "bg-muted")} />}
          </div>
        ))}
      </div>

      <Card className="border-border bg-card shadow-lg">
        
        {/* === PASSO 1: ESCOLHA DO NICHO === */}
        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle>Qual o seu ramo?</CardTitle>
              <CardDescription>Vamos personalizar o sistema para o seu tipo de negócio.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gera os botões baseados no arquivo niche-config.ts */}
              {nicheOptions.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => setFormData(prev => ({ ...prev, niche: item.id }))}
                  className={cn(
                    "cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center text-center gap-3 transition-all hover:bg-muted/50",
                    formData.niche === item.id ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className={cn("p-2 rounded-full bg-muted", formData.niche === item.id && "bg-primary text-primary-foreground")}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-6">
              <Button onClick={() => setStep(1)}>
                Continuar <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </div>
        )}

        {/* === PASSO 2: DADOS BÁSICOS === */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Como você gostaria de chamar sua organização?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da {currentNicheLabel}</Label>
                <Input 
                  id="name" name="name" 
                  value={formData.name} onChange={handleChange} 
                  placeholder={`Ex: Minha ${currentNicheLabel} Inc.`}
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
            <CardFooter className="flex justify-between border-t pt-6">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!formData.name}>
                Próximo <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </div>
        )}

        {/* === PASSO 3: ENDEREÇO E CONTATO === */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <CardHeader>
              <CardTitle>Contato & Endereço</CardTitle>
              <CardDescription>Como seus clientes te encontram?</CardDescription>
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
                    placeholder="contato@empresa.com" 
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
              <Button variant="outline" onClick={() => setStep(1)}>
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