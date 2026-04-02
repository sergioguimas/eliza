'use client'

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createOrganization } from "@/app/actions/organization"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  Loader2,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Rocket,
  Link2,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { getSetupNicheOptions } from "@/lib/niche-config"

const TOTAL_STEPS = 3 as const

type Step = 1 | 2 | 3

type FormDataState = {
  niche: string
  name: string
  slug: string
}

type FormErrors = {
  niche?: string
  name?: string
  slug?: string
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

const panelMotion = {
  initial: { opacity: 0, x: 18, filter: "blur(4px)" },
  animate: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: -18, filter: "blur(4px)" },
  transition: { duration: 0.24, ease: "easeOut" as const },
}

export function SetupForm() {
  const [step, setStep] = useState<Step>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const [formData, setFormData] = useState<FormDataState>({
    niche: '',
    name: '',
    slug: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const nicheOptions = useMemo(() => getSetupNicheOptions(), [])

  const selectedNiche = useMemo(() => {
    return nicheOptions.find((option) => option.id === formData.niche)
  }, [formData.niche, nicheOptions])

  const NicheIcon = selectedNiche?.icon || Briefcase

  const router = useRouter()

  const updateField = <K extends keyof FormDataState>(key: K, value: FormDataState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validateStep1 = () => {
    const nextErrors: FormErrors = {}

    if (!formData.niche) {
      nextErrors.niche = "Selecione um ramo de atuação para continuar."
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))

    if (nextErrors.niche) {
      toast.warning(nextErrors.niche)
      return false
    }

    return true
  }

  const validateStep2 = () => {
    const nextErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedSlug = formData.slug.trim()

    if (!trimmedName) {
      nextErrors.name = "Informe o nome do negócio."
    } else if (trimmedName.length < 3) {
      nextErrors.name = "O nome do negócio deve ter pelo menos 3 caracteres."
    }

    if (!trimmedSlug) {
      nextErrors.slug = "Informe o link do sistema."
    } else if (trimmedSlug.length < 3) {
      nextErrors.slug = "O link precisa ter pelo menos 3 caracteres."
    } else if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      nextErrors.slug = "Use apenas letras minúsculas, números e traços."
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))

    const firstError = nextErrors.name || nextErrors.slug
    if (firstError) {
      toast.warning(firstError)
      return false
    }

    return true
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS) as Step)
  }

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1) as Step)
  }

  const handleNameChange = (value: string) => {
    updateField("name", value)

    if (!slugTouched) {
      updateField("slug", normalizeSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugTouched(true)
    updateField("slug", normalizeSlug(value))
  }

  const handleStep2KeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleNext()
    }
  }

  async function onSubmit() {
    if (step !== 3) return
    if (!validateStep1() || !validateStep2()) return

    setIsLoading(true)

    try {
      const data = new FormData()
      data.append("niche", formData.niche)
      data.append("name", formData.name.trim())
      data.append("slug", formData.slug.trim())

      const result = await createOrganization(data)

      if (result?.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      if (result?.success && result.redirectTo) {
        router.push(result.redirectTo)
        return
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Erro ao finalizar setup:", error)
      toast.error("Não foi possível concluir o setup agora.")
      setIsLoading(false)
    }
  }

  const stepTitle =
    step === 1
      ? "Qual é o seu universo?"
      : step === 2
        ? "Batize seu espaço"
        : "Tudo pronto para começar?"

  const stepDescription =
    step === 1
      ? "Escolha o nicho que mais combina com a operação do seu negócio."
      : step === 2
        ? "Defina o nome da empresa e o endereço que sua equipe vai usar."
        : "Revise as informações antes de criar seu ambiente."

  return (
    <Card className="mx-auto flex min-h-[620px] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.25)]">
      <div className="relative h-1.5 w-full bg-zinc-100">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>

      <CardHeader className="space-y-6 border-b border-zinc-100 px-6 pb-6 pt-7 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
              <Rocket className="h-3.5 w-3.5" />
              Setup inicial do sistema
            </div>

            <div className="space-y-1.5">
              <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                {stepTitle}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
                {stepDescription}
              </CardDescription>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              Etapa atual
            </div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">
              {step}/{TOTAL_STEPS}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((item) => {
            const isActive = step === item
            const isDone = step > item

            return (
              <motion.div
                key={item}
                layout
                className={cn(
                  "rounded-2xl border px-3 py-3 transition-all",
                  isActive && "border-primary bg-primary/5",
                  isDone && "border-emerald-200 bg-emerald-50",
                  !isActive && !isDone && "border-zinc-200 bg-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isDone && "border-emerald-500 bg-emerald-500 text-white",
                      !isActive && !isDone && "border-zinc-300 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : item}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-900 sm:text-sm">
                      {item === 1 && "Nicho"}
                      {item === 2 && "Identidade"}
                      {item === 3 && "Revisão"}
                    </p>
                    <p className="hidden text-[11px] text-zinc-500 sm:block">
                      {item === 1 && "Seleção do ramo"}
                      {item === 2 && "Nome e link"}
                      {item === 3 && "Confirmação final"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardHeader>

      <form onSubmit={(e) => e.preventDefault()} className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-8">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div key="step-1" {...panelMotion} className="space-y-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {nicheOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = formData.niche === option.id

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateField("niche", option.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
                          "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          isSelected
                            ? cn("ring-2", option.selected)
                            : "border-zinc-200 bg-white hover:border-zinc-300"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-200",
                            option.soft,
                            isSelected && "opacity-100",
                            !isSelected && "group-hover:opacity-60"
                          )}
                        />

                        <div className="relative flex h-full flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={cn(
                                "flex h-11 w-11 items-center justify-center rounded-2xl border bg-white shadow-sm",
                                isSelected ? "border-white/60" : "border-zinc-200",
                                option.color
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>

                            <div
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-zinc-200 bg-white text-transparent"
                              )}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-zinc-950">
                              {option.label}
                            </p>
                            <p className="text-xs leading-relaxed text-zinc-500">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {errors.niche && (
                  <p className="text-sm text-red-500">
                    {errors.niche}
                  </p>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                {...panelMotion}
                className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
              >
                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="name" className="text-sm font-semibold text-zinc-800">
                      Nome do Negócio
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onKeyDown={handleStep2KeyDown}
                      placeholder="Ex: Clínica Central, Studio Aurora..."
                      className={cn(
                        "h-12 rounded-xl border-zinc-200 text-base shadow-none focus-visible:ring-2",
                        errors.name && "border-red-500 focus-visible:ring-red-200"
                      )}
                      autoFocus
                      maxLength={80}
                    />
                    <p className={cn("text-xs", errors.name ? "text-red-500" : "text-zinc-500")}>
                      {errors.name || "Esse nome será usado como identificação principal do ambiente."}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <Label htmlFor="slug" className="text-sm font-semibold text-zinc-800">
                      Link do Sistema
                    </Label>

                    <div
                      className={cn(
                        "flex h-12 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 transition-all focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20",
                        errors.slug && "border-red-500"
                      )}
                    >
                      <Globe className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="mr-1 shrink-0 text-sm font-medium text-zinc-500">
                        eliza.app/
                      </span>

                      <input
                        id="slug"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        onKeyDown={handleStep2KeyDown}
                        placeholder="minha-empresa"
                        className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={50}
                      />
                    </div>

                    <p className={cn("text-xs leading-relaxed", errors.slug ? "text-red-500" : "text-zinc-500")}>
                      {errors.slug || "Use apenas letras minúsculas, números e traços. Esse link será único para sua equipe."}
                    </p>
                  </div>
                </div>

                <motion.div
                  layout
                  className="rounded-[24px] border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5 shadow-sm"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    <Link2 className="h-4 w-4" />
                    Prévia do seu acesso
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                      Ambiente
                    </p>

                    <p className="mt-2 break-words text-lg font-semibold text-zinc-950">
                      {formData.name?.trim() || "Nome do seu negócio"}
                    </p>

                    <div className="mt-4 rounded-xl bg-primary/5 px-3 py-3 text-sm">
                      <span className="text-zinc-500">eliza.app/</span>
                      <span className="break-all font-semibold text-primary">
                        {formData.slug || "minha-empresa"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Endereço limpo, profissional e fácil de compartilhar com a equipe.
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                {...panelMotion}
                className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
              >
                <div className="rounded-[26px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <NicheIcon className="h-6 w-6" />
                    </div>

                    <div>
                      <p className="text-sm text-zinc-500">Resumo do ambiente</p>
                      <p className="text-lg font-semibold text-zinc-950">
                        Pronto para criação
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                        Nicho selecionado
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">
                        {selectedNiche?.label}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                        Nome do negócio
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-zinc-900">
                        {formData.name}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-400">
                        URL de acesso
                      </p>
                      <p className="mt-1 break-all text-sm font-semibold text-primary">
                        eliza.app/{formData.slug}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-white p-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verificação final
                    </div>

                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      Seu ambiente será criado com esses dados
                    </h3>

                    <p className="text-sm leading-relaxed text-zinc-600">
                      Ao finalizar, sua organização será configurada e você seguirá para o próximo passo do sistema.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                      <p className="text-xs text-zinc-500">Estrutura inicial</p>
                      <p className="text-sm font-medium text-zinc-900">
                        Ambiente preparado para começar
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
                      <p className="text-xs text-zinc-500">Acesso principal</p>
                      <p className="break-all text-sm font-medium text-zinc-900">
                        eliza.app/{formData.slug}
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 text-xs leading-relaxed text-zinc-500">
                    Revise os dados com atenção. Depois da criação, ainda será possível ajustar outras informações dentro do painel.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-zinc-100 px-6 py-5 sm:px-8">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={isLoading}
              className="rounded-xl px-4 text-zinc-600 hover:text-zinc-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <div />
          )}

          <AnimatePresence mode="wait" initial={false}>
            {step < 3 ? (
              <motion.div
                key="next-button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Button
                  type="button"
                  onClick={handleNext}
                  className="rounded-xl px-5 shadow-sm"
                >
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="submit-button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <Button
                  type="button"
                  onClick={onSubmit}
                  disabled={isLoading}
                  className="min-w-[170px] rounded-xl px-5 shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    "Finalizar Setup"
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardFooter>
      </form>
    </Card>
  )
}