'use client'

import { useState } from "react"
import { createOrganization } from "@/app/actions/organization"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Loader2, 
  Building2, 
  Store, 
  Briefcase, 
  Scissors, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Globe
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Opções de Nicho com metadados visuais
const NICHE_OPTIONS = [
  { id: 'clinica', label: 'Saúde & Clínica', icon: Building2, color: 'text-blue-500', border: 'hover:border-blue-500', bg: 'hover:bg-blue-50' },
  { id: 'advocacia', label: 'Advocacia', icon: Briefcase, color: 'text-red-800', border: 'hover:border-red-800', bg: 'hover:bg-red-50' },
  { id: 'barbearia', label: 'Barbearia', icon: Scissors, color: 'text-orange-600', border: 'hover:border-orange-600', bg: 'hover:bg-orange-50' },
  { id: 'salao', label: 'Salão de Beleza', icon: Sparkles, color: 'text-pink-500', border: 'hover:border-pink-500', bg: 'hover:bg-pink-50' },
  { id: 'generico', label: 'Outro Negócio', icon: Store, color: 'text-slate-600', border: 'hover:border-slate-600', bg: 'hover:bg-slate-50' },
]

export function SetupForm() {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  // Estado único para todos os passos
  const [formData, setFormData] = useState({
    niche: '',
    name: '',
    slug: ''
  })

  // Avança para o próximo passo com validação simples
  const handleNext = () => {
    if (step === 1 && !formData.niche) {
      toast.warning("Por favor, selecione o ramo de atuação.")
      return
    }
    if (step === 2 && (!formData.name || !formData.slug)) {
      toast.warning("Preencha o nome e a URL do seu sistema.")
      return
    }
    setStep((prev) => prev + 1)
  }

  // Volta um passo
  const handleBack = () => setStep((prev) => prev - 1)

  // Envio final
  async function onSubmit() {
    setIsLoading(true)
    
    // Converte o objeto de estado para FormData (exigido pela Server Action)
    const data = new FormData()
    data.append('niche', formData.niche)
    data.append('name', formData.name)
    data.append('slug', formData.slug)

    const result = await createOrganization(data)
    
    if (result?.error) {
      toast.error(result.error)
      setIsLoading(false)
    }
    // Sucesso = Redirecionamento automático via Server Action
  }

  // Helper para atualizar campos
  const updateField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  // Helper para gerar slug automático baseado no nome (se o slug estiver vazio)
  const handleNameBlur = () => {
    if (!formData.slug && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, "-") // Troca espaços/especiais por traço
        .replace(/-+/g, "-") // Remove traços duplicados
        .replace(/^-|-$/g, "") // Remove traços do início/fim
      
      updateField('slug', slug)
    }
  }

  const selectedNiche = NICHE_OPTIONS.find(n => n.id === formData.niche)
  const NicheIcon = selectedNiche?.icon || Store

  return (
    <Card className="w-full max-w-xl mx-auto shadow-xl border-0 ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden flex flex-col min-h-[500px]">
      
      {/* HEADER: PROGRESSO */}
      <div className="w-full h-2 bg-gray-100 dark:bg-gray-800">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-in-out" 
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <CardHeader className="space-y-1 text-center pb-2 pt-8">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {step === 1 && "Qual é o seu Universo?"}
          {step === 2 && "Batize seu Espaço"}
          {step === 3 && "Tudo pronto?"}
        </CardTitle>
        <CardDescription className="text-base">
          {step === 1 && "Escolha o nicho que mais se adapta ao seu negócio."}
          {step === 2 && "Defina como seus clientes vão encontrar você."}
          {step === 3 && "Confirme os dados para iniciarmos o sistema."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-center py-6">
        
        {/* PASSO 1: NICHO */}
        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
            {NICHE_OPTIONS.map((option) => {
              const Icon = option.icon
              const isSelected = formData.niche === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => updateField('niche', option.id)}
                  type="button"
                  className={cn(
                    "relative flex items-center p-4 gap-4 rounded-xl border-2 transition-all duration-200 text-left",
                    isSelected 
                      ? `border-primary bg-primary/5 ring-1 ring-primary` 
                      : `border-transparent bg-gray-50 dark:bg-gray-900 ${option.border} ${option.bg}`
                  )}
                >
                  <div className={cn("p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm", option.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold block text-sm">{option.label}</span>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-primary">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* PASSO 2: DADOS */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 px-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base">Nome do Negócio</Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Ex: Dr. House Clínica, Barbearia Viking..." 
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-base">Link do Sistema</Label>
              <div className="flex items-center rounded-lg border bg-gray-50 dark:bg-gray-900 px-3 h-12 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                <Globe className="h-4 w-4 text-muted-foreground mr-2" />
                <span className="text-muted-foreground text-sm font-medium mr-1">eliza.app/</span>
                <input 
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="minha-empresa" 
                  className="flex-1 bg-transparent border-none outline-none text-sm font-medium h-full"
                />
              </div>
              <p className="text-xs text-muted-foreground ml-1">
                Este será o endereço único que você e sua equipe usarão.
                Não use espaços ou caracteres especiais, apenas letras, números e traços.
              </p>
            </div>
          </div>
        )}

        {/* PASSO 3: REVISÃO */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 px-8">
            <div className="rounded-xl border bg-gray-50 dark:bg-gray-900 p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <NicheIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nicho Selecionado</p>
                  <p className="font-semibold text-lg">
                    <NicheIcon className="w-6 h-6" />
                  </p>
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">Nome do Negócio</p>
                <p className="font-medium">{formData.name}</p>
              </div>

              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">URL de Acesso</p>
                <p className="font-medium text-primary flex items-center gap-1">
                  eliza.app/<span className="font-bold underline">{formData.slug}</span>
                </p>
              </div>
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              Ao clicar em finalizar, seu ambiente será configurado instantaneamente.
            </p>
          </div>
        )}

      </CardContent>

      <CardFooter className="flex justify-between pt-2 pb-8 px-8">
        {step > 1 ? (
          <Button 
            variant="ghost" 
            onClick={handleBack}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        ) : (
          <div /> /* Spacer */
        )}

        {step < 3 ? (
          <Button onClick={handleNext} className="pl-6 pr-4">
            Próximo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onSubmit} disabled={isLoading} className="pl-6 pr-4 min-w-[140px]">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Finalizar Setup"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}