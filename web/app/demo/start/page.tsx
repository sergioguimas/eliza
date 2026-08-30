import type { Metadata } from "next"
import { Clock, ShieldCheck, Sparkles } from "lucide-react"
import { DemoNichePicker } from "./demo-niche-picker"

export const metadata: Metadata = {
  title: "Demonstração",
  description:
    "Experimente o Eliza com uma agenda já preenchida do seu segmento. Sem cadastro.",
}

const HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "Já vem preenchido",
    description:
      "Profissionais, serviços, clientes e agenda do seu segmento, prontos para mexer.",
  },
  {
    icon: ShieldCheck,
    title: "Sem cadastro",
    description: "Nenhum e-mail, nenhuma senha. É só escolher e começar.",
  },
  {
    icon: Clock,
    title: "Some em 24 horas",
    description:
      "O ambiente é só seu e se apaga sozinho. Nada do que você fizer aqui fica.",
  },
]

export default function DemoStartPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Demonstração
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Veja o Eliza funcionando com a cara do seu negócio
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Escolha o seu segmento e entre num sistema já em uso — com agenda,
            clientes e histórico. Você agenda, conclui, anota e vê como os avisos
            chegam ao cliente.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="escolha-segmento">
          <h2
            id="escolha-segmento"
            className="mb-4 text-sm font-medium text-foreground"
          >
            Qual é o seu segmento?
          </h2>

          <DemoNichePicker />
        </section>

        <ul className="mt-12 grid grid-cols-1 gap-6 border-t border-border pt-8 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon

            return (
              <li key={item.title} className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
