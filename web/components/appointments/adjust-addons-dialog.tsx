'use client'

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { adjustAppointmentAddons } from "@/app/actions/adjust-appointment-addons"
import { AddonsPicker } from "@/components/appointments/addons-picker"
import type { AdicionalEscolhido } from "@/contracts/comum/adicionais"
import { lerAdicionais, lerAdicionaisAplicados, somarAdicionais, type Adicional } from "@/lib/adicionais"
import { formatarReais } from "@/lib/preco"

/** O que o diálogo lê do agendamento do painel (linha do Supabase com a relação do serviço). */
type AgendamentoDoPainel = {
  id: string
  price?: number | null
  addons?: unknown
  customers?: { name?: string | null } | null
  services?: { title?: string | null; addons?: unknown } | null
}

const arredondar = (valor: number) => Math.round(valor * 100) / 100

/**
 * Lista do seletor: catálogo atual do serviço, mas item já escolhido mantém os dados da
 * cópia (o ajuste não reprecifica), e item que saiu do catálogo continua na lista.
 */
function listaDeAdicionais(appointment: AgendamentoDoPainel): Adicional[] {
  const copia = lerAdicionaisAplicados(appointment?.addons)
  const catalogo = lerAdicionais(appointment?.services?.addons)

  const doCatalogo = catalogo.map((c) => {
    const aplicado = copia.find((a) => a.id === c.id)

    return aplicado ? { id: c.id, nome: aplicado.nome, valor: aplicado.valorUnitario, unidade: aplicado.unidade } : c
  })

  const foraDoCatalogo = copia
    .filter((a) => !catalogo.some((c) => c.id === a.id))
    .map((a) => ({ id: a.id, nome: a.nome, valor: a.valorUnitario, unidade: a.unidade }))

  return [...doCatalogo, ...foraDoCatalogo]
}

function Conteudo({ appointment, onClose }: { appointment: AgendamentoDoPainel; onClose: () => void }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const copia = useMemo(() => lerAdicionaisAplicados(appointment.addons), [appointment.addons])
  const lista = useMemo(() => listaDeAdicionais(appointment), [appointment])
  const [value, setValue] = useState<AdicionalEscolhido[]>(() =>
    copia.map((a) => ({ id: a.id, quantidade: a.quantidade }))
  )

  const escolhidos = lista.flatMap((a) => {
    const escolhido = value.find((v) => v.id === a.id)

    return escolhido ? [{ ...a, quantidade: escolhido.quantidade, valorUnitario: a.valor }] : []
  })

  // Mesma conta do servidor: o preço base é o total gravado menos os adicionais atuais.
  const base = arredondar(Number(appointment.price ?? 0) - somarAdicionais(copia))
  const totalAdicionais = somarAdicionais(escolhidos)
  const novoTotal = arredondar(base + totalAdicionais)

  async function salvar() {
    setIsLoading(true)

    const result = await adjustAppointmentAddons(appointment.id, value)

    if (result?.error) {
      toast.error(result.error)
      // Recusa costuma ser tela desatualizada (pago em outra aba): recarrega para mostrar o estado real.
      router.refresh()
    } else {
      toast.success(result.alterado ? "Adicionais atualizados." : "Nada mudou.")
      onClose()
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ajustar adicionais</DialogTitle>
        <DialogDescription>
          <span className="font-bold text-foreground">{appointment.customers?.name}</span>
          {appointment.services?.title ? `, ${appointment.services.title}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <AddonsPicker adicionais={lista} value={value} onChange={setValue} titulo="Adicionais usados" />

        <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{appointment.services?.title || "Serviço"}</span>
            <span className="text-foreground">{formatarReais(base)}</span>
          </div>

          {escolhidos.map((a) => (
            <div key={a.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {a.unidade ? `${a.nome} × ${a.quantidade}` : a.nome}
              </span>
              <span className="text-foreground">
                + {formatarReais(somarAdicionais([{ valorUnitario: a.valorUnitario, quantidade: a.quantidade }]))}
              </span>
            </div>
          ))}

          <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
            <span className="text-foreground">Novo total</span>
            <span className="text-foreground">{formatarReais(novoTotal)}</span>
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Voltar
        </Button>
        <Button type="button" onClick={salvar} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </>
  )
}

/** Ajuste dos adicionais de um agendamento ainda não pago. O estado reinicia a cada abertura. */
export function AdjustAddonsDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: AgendamentoDoPainel
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <Conteudo appointment={appointment} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
