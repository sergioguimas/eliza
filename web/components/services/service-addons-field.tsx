'use client'

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LIMITE_ADICIONAIS,
  TAMANHO_NOME_ADICIONAL,
  TAMANHO_UNIDADE_ADICIONAL,
  VALOR_MAXIMO_ADICIONAL,
  lerAdicionais,
} from "@/lib/adicionais"

type Linha = { chave: number; nome: string; valor: string; unidade: string }

const CLASSE_INPUT = "border-input bg-background text-foreground placeholder:text-muted-foreground"

/**
 * Fica dentro do DialogContent de propósito: ele desmonta ao fechar, então
 * reabrir sem salvar volta ao que está gravado, como os outros campos do formulário.
 */
export function ServiceAddonsField({ defaultValue }: { defaultValue?: unknown }) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    lerAdicionais(defaultValue).map((a, chave) => ({
      chave,
      nome: a.nome,
      valor: String(a.valor),
      unidade: a.unidade ?? "",
    }))
  )
  const [proximaChave, setProximaChave] = useState(linhas.length)

  function adicionar() {
    setLinhas((atuais) => [...atuais, { chave: proximaChave, nome: "", valor: "", unidade: "" }])
    setProximaChave((chave) => chave + 1)
  }

  function alterar(chave: number, campo: "nome" | "valor" | "unidade", valor: string) {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)))
  }

  const addons = linhas.map((l) => ({ name: l.nome, price: Number(l.valor), unit: l.unidade }))

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <input type="hidden" name="addons" value={JSON.stringify(addons)} />

      <div className="space-y-0.5">
        <Label className="text-foreground">Adicionais opcionais</Label>
        <p className="text-xs text-muted-foreground">
          Valores extras que podem ser cobrados além do preço, conforme o atendimento.
        </p>
      </div>

      {linhas.map((linha, indice) => (
        <div key={linha.chave} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
          <Input
            aria-label={`Nome do adicional ${indice + 1}`}
            placeholder="Ex.: Unha quebrada"
            required
            maxLength={TAMANHO_NOME_ADICIONAL}
            value={linha.nome}
            onChange={(e) => alterar(linha.chave, "nome", e.target.value)}
            className={`col-span-3 sm:col-span-1 ${CLASSE_INPUT}`}
          />
          <Input
            aria-label={`Valor em reais do adicional ${indice + 1}`}
            placeholder="R$"
            type="number"
            step="0.01"
            min="0.01"
            max={VALOR_MAXIMO_ADICIONAL}
            required
            value={linha.valor}
            onChange={(e) => alterar(linha.chave, "valor", e.target.value)}
            className={CLASSE_INPUT}
          />
          <Input
            aria-label={`Unidade do adicional ${indice + 1}, opcional`}
            placeholder="Ex.: por unha"
            maxLength={TAMANHO_UNIDADE_ADICIONAL}
            value={linha.unidade}
            onChange={(e) => alterar(linha.chave, "unidade", e.target.value)}
            className={CLASSE_INPUT}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Remover adicional ${indice + 1}`}
            onClick={() => setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {linhas.length < LIMITE_ADICIONAIS && (
        <Button type="button" variant="outline" size="sm" onClick={adicionar}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      )}
    </div>
  )
}
