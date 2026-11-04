import { lerAdicionaisAplicados } from "@/lib/adicionais"
import { formatarReais } from "@/lib/preco"

/** Adicionais escolhidos no agendamento, em uma linha do card. Não renderiza nada sem adicionais. */
export function AddonsSummary({ addons }: { addons: unknown }) {
  const itens = lerAdicionaisAplicados(addons)

  if (itens.length === 0) return null

  return (
    <p className="text-xs text-muted-foreground">
      Adicionais:{" "}
      {itens
        .map((i) => `${i.unidade ? `${i.nome} × ${i.quantidade}` : i.nome} (+ ${formatarReais(i.total)})`)
        .join(", ")}
    </p>
  )
}
