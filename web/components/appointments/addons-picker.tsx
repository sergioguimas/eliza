'use client'

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { QUANTIDADE_MAXIMA_ADICIONAL, type AdicionalEscolhido } from "@/contracts/comum/adicionais"
import type { Adicional } from "@/lib/adicionais"
import { rotuloAdicional } from "@/lib/preco"

type Props = {
  adicionais: Adicional[]
  /** Só itens escolhidos (quantidade 1 ou mais); quantidade 0 sai da lista. */
  value: AdicionalEscolhido[]
  onChange: (value: AdicionalEscolhido[]) => void
  titulo?: string
}

/**
 * Escolha de adicionais do serviço, compartilhada entre o /marcar e os diálogos do
 * painel. Controlado: quem usa guarda a lista e a zera ao trocar de serviço.
 * Só usa tokens de tema, porque a página pública herda `theme-<nicho>` e `palette-<id>`.
 */
export function AddonsPicker({ adicionais, value, onChange, titulo = "Adicionais (opcional)" }: Props) {
  if (adicionais.length === 0) return null

  const quantidadeDe = (id: string) => value.find((v) => v.id === id)?.quantidade ?? 0

  function definir(id: string, quantidade: number) {
    const restantes = value.filter((v) => v.id !== id)

    onChange(quantidade > 0 ? [...restantes, { id, quantidade }] : restantes)
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{titulo}</legend>

      <ul className="space-y-2">
        {adicionais.map((adicional) => {
          const quantidade = quantidadeDe(adicional.id)

          return (
            <li
              key={adicional.id}
              className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              {adicional.unidade ? (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{adicional.nome}</p>
                    <p className="text-xs text-muted-foreground">{rotuloAdicional(adicional)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Diminuir quantidade de ${adicional.nome}`}
                      disabled={quantidade === 0}
                      onClick={() => definir(adicional.id, quantidade - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>

                    <span
                      className="w-8 text-center text-sm font-semibold tabular-nums text-foreground"
                      aria-live="polite"
                      aria-label={`Quantidade de ${adicional.nome}`}
                    >
                      {quantidade}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Aumentar quantidade de ${adicional.nome}`}
                      disabled={quantidade >= QUANTIDADE_MAXIMA_ADICIONAL}
                      onClick={() => definir(adicional.id, quantidade + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{adicional.nome}</span>
                    <span className="block text-xs text-muted-foreground">{rotuloAdicional(adicional)}</span>
                  </span>

                  <Checkbox
                    className="size-6"
                    checked={quantidade > 0}
                    onCheckedChange={(marcado) => definir(adicional.id, marcado === true ? 1 : 0)}
                  />
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
