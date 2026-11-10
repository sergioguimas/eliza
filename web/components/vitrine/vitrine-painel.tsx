"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { ItemVitrinePainel } from "@/lib/domain/vitrine"
import type { MidiaPainel } from "@/contracts/painel/midia"
import {
  adicionarItemVitrine,
  editarItemVitrine,
  removerItemVitrine,
  reordenarVitrineAction,
} from "@/app/actions/vitrine"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { MediaPicker } from "@/components/midia/media-picker"
import { cn } from "@/lib/utils"

/** Debounce da gravação da ordem (05 §2/§3): mover três posições = uma gravação. */
const ESPERA_ORDEM_MS = 600
const SEM_CATEGORIA = "__nenhuma__"
const LEGENDA_MAX = 60

const chaveDe = (nome: string) => nome.trim().toLowerCase()

type Props = {
  itens: ItemVitrinePainel[]
  /** Nomes das categorias existentes nos serviços (para o select de cada item). */
  categorias: string[]
  /** Máximo de itens ativos (LIMITE_ITENS_ATIVOS do domínio). */
  limiteAtivos: number
}

/** Página Vitrine (contrato midia-vitrine/05 §3). Só owner/admin chegam aqui; as actions recusam o resto. */
export function VitrinePainel({ itens, categorias, limiteAtivos }: Props) {
  const [lista, setLista] = useState(itens)
  const [escolhendo, setEscolhendo] = useState(false)
  const [nova, setNova] = useState<MidiaPainel | null>(null)
  const [removendo, setRemovendo] = useState<ItemVitrinePainel | null>(null)

  const listaRef = useRef(lista)
  const confirmada = useRef(itens)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendente = useRef(false)

  // Depois de cada ação a página revalida e chega lista nova; só adota se não há ordem esperando para gravar.
  const [itensAnteriores, setItensAnteriores] = useState(itens)
  const [ordenando, setOrdenando] = useState(false)

  if (itens !== itensAnteriores) {
    setItensAnteriores(itens)
    if (!ordenando) setLista(itens)
  }

  useEffect(() => {
    if (pendente.current) return
    listaRef.current = itens
    confirmada.current = itens
  }, [itens])

  const alterar = useCallback((fn: (atual: ItemVitrinePainel[]) => ItemVitrinePainel[], tambemConfirmada = true) => {
    const novaLista = fn(listaRef.current)
    listaRef.current = novaLista
    setLista(novaLista)
    if (tambemConfirmada) confirmada.current = fn(confirmada.current)
  }, [])

  const gravarOrdem = useCallback(async () => {
    temporizador.current = null
    const enviada = listaRef.current
    const resultado = await reordenarVitrineAction(enviada.map((i) => i.id))

    if ("error" in resultado) {
      toast.error(resultado.error ?? "Não foi possível salvar a ordem.")
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = null
      pendente.current = false
      setOrdenando(false)
      listaRef.current = confirmada.current
      setLista(confirmada.current)
      return
    }

    confirmada.current = enviada
    if (temporizador.current === null) {
      pendente.current = false
      setOrdenando(false)
    }
  }, [])

  // Sair da tela com ordem ainda esperando: grava na hora em vez de perder o toque.
  useEffect(() => {
    return () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current)
        temporizador.current = null
        void reordenarVitrineAction(listaRef.current.map((i) => i.id))
      }
    }
  }, [])

  function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta
    if (destino < 0 || destino >= listaRef.current.length) return

    const copia = [...listaRef.current]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]

    listaRef.current = copia
    pendente.current = true
    setOrdenando(true)
    setLista(copia)

    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(gravarOrdem, ESPERA_ORDEM_MS)
  }

  const ativos = lista.filter((i) => i.ativo).length
  const cheia = ativos >= limiteAtivos

  async function adicionar(legenda: string) {
    if (!nova) return null

    const resultado = await adicionarItemVitrine({ mediaId: nova.id, legenda, categoria: null })

    if ("error" in resultado) return resultado.error ?? "Não foi possível adicionar a foto."

    alterar((atual) => [...atual, resultado.resultado])
    setNova(null)
    toast.success("Foto adicionada à vitrine.")
    return null
  }

  async function remover(item: ItemVitrinePainel) {
    const resultado = await removerItemVitrine(item.id)

    if ("error" in resultado) {
      toast.error(resultado.error ?? "Não foi possível remover o item.")
      return
    }

    alterar((atual) => atual.filter((i) => i.id !== item.id))
    setRemovendo(null)
    toast.success("Foto removida da vitrine.")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Vitrine</h1>
          <p className="text-sm text-muted-foreground">Fotos do seu trabalho que aparecem no seu site.</p>
        </div>

        <div className="space-y-1 md:text-right">
          <Button className="min-h-11 w-full md:w-auto" disabled={cheia} onClick={() => setEscolhendo(true)}>
            <ImagePlus />
            Adicionar foto
          </Button>
          {cheia && (
            <p className="text-xs text-muted-foreground">
              A vitrine já tem {limiteAtivos} fotos no site. Desative ou remova uma para adicionar outra.
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {ativos} de {limiteAtivos} no site
      </p>

      {lista.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border py-16 text-center">
          <p className="mx-auto max-w-sm px-4 text-sm text-muted-foreground">
            Sua vitrine está vazia. Enquanto isso, o site mostra as fotos que vieram com ele.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((item, indice) => (
            <ItemCard
              key={item.id}
              item={item}
              categorias={categorias}
              primeiro={indice === 0}
              ultimo={indice === lista.length - 1}
              semVaga={cheia}
              aoMover={(delta) => mover(indice, delta)}
              aoRemover={() => setRemovendo(item)}
              aoAtualizar={(campos) =>
                alterar((atual) => atual.map((i) => (i.id === item.id ? { ...i, ...campos } : i)))
              }
            />
          ))}
        </ul>
      )}

      <MediaPicker
        open={escolhendo}
        onOpenChange={setEscolhendo}
        titulo="Foto para a vitrine"
        onEscolher={(foto) => {
          setEscolhendo(false)
          setNova(foto)
        }}
        descreverUsos={(mediaId) => (lista.some((i) => i.foto.id === mediaId) ? ["na vitrine"] : [])}
      />

      <LegendaNova foto={nova} aoFechar={() => setNova(null)} aoConfirmar={adicionar} />

      <AlertDialog open={!!removendo} onOpenChange={(v) => !v && setRemovendo(null)}>
        <AlertDialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da vitrine?</AlertDialogTitle>
            <AlertDialogDescription>Sai da vitrine; a foto continua na biblioteca.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={(e) => {
                e.preventDefault()
                if (removendo) void remover(removendo)
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ItemCard({
  item,
  categorias,
  primeiro,
  ultimo,
  semVaga,
  aoMover,
  aoRemover,
  aoAtualizar,
}: {
  item: ItemVitrinePainel
  categorias: string[]
  primeiro: boolean
  ultimo: boolean
  /** Já há o máximo de itens ativos: não dá para ligar mais um. */
  semVaga: boolean
  aoMover: (delta: -1 | 1) => void
  aoRemover: () => void
  aoAtualizar: (campos: Partial<Pick<ItemVitrinePainel, "legenda" | "categoria" | "ativo">>) => void
}) {
  const [legenda, setLegenda] = useState(item.legenda)
  const [salvo, setSalvo] = useState(false)
  const [erroLegenda, setErroLegenda] = useState<string | null>(null)
  const [legendaDoServidor, setLegendaDoServidor] = useState(item.legenda)

  // legenda vinda do servidor (revalidação) substitui o campo, exceto se a pessoa está no meio de uma edição
  if (item.legenda !== legendaDoServidor) {
    setLegendaDoServidor(item.legenda)
    setLegenda(item.legenda)
  }

  async function salvarLegenda() {
    const limpa = legenda.trim()

    if (limpa === item.legenda) {
      setLegenda(item.legenda)
      setErroLegenda(null)
      return
    }

    if (limpa.length < 1 || limpa.length > LEGENDA_MAX) {
      setErroLegenda("A legenda precisa ter de 1 a 60 caracteres.")
      return
    }

    setErroLegenda(null)
    const resultado = await editarItemVitrine(item.id, { legenda: limpa })

    if ("error" in resultado) {
      toast.error(resultado.error ?? "Não foi possível salvar a legenda.")
      setLegenda(item.legenda)
      return
    }

    aoAtualizar({ legenda: limpa })
    setLegenda(limpa)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  async function trocarCategoria(valor: string) {
    const categoria = valor === SEM_CATEGORIA ? null : valor
    const anterior = item.categoria

    aoAtualizar({ categoria })
    const resultado = await editarItemVitrine(item.id, { categoria })

    if ("error" in resultado) {
      aoAtualizar({ categoria: anterior })
      toast.error(resultado.error ?? "Não foi possível trocar a categoria.")
    }
  }

  async function alternarAtivo(ativo: boolean) {
    aoAtualizar({ ativo })
    const resultado = await editarItemVitrine(item.id, { ativo })

    if ("error" in resultado) {
      aoAtualizar({ ativo: !ativo })
      // vitrine cheia (CONFLICT/LIMITE_VITRINE) chega aqui com a mensagem do domínio
      toast.error(resultado.error ?? "Não foi possível salvar.")
    }
  }

  const existente = item.categoria ? categorias.find((c) => chaveDe(c) === chaveDe(item.categoria!)) : undefined
  const valorCategoria = item.categoria ? (existente ?? item.categoria) : SEM_CATEGORIA
  const categoriaSumiu = !!item.categoria && !existente

  return (
    <li className={cn("space-y-3 rounded-lg border border-border bg-card p-3", !item.ativo && "bg-muted/30")}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.foto.urlPequena}
          alt={item.foto.alt}
          width={480}
          height={640}
          loading="lazy"
          decoding="async"
          className={cn("aspect-[3/4] w-20 shrink-0 self-start rounded-md object-cover", !item.ativo && "opacity-50")}
          style={{ backgroundColor: item.foto.cor }}
        />

        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1">
            <Input
              value={legenda}
              maxLength={LEGENDA_MAX}
              onChange={(e) => setLegenda(e.target.value)}
              onBlur={salvarLegenda}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              aria-label="Legenda da foto"
              aria-invalid={!!erroLegenda}
              className="h-11"
            />
            <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
              {erroLegenda ? <span className="text-destructive">{erroLegenda}</span> : salvo ? "Salvo" : ""}
            </p>
          </div>

          <Select value={valorCategoria} onValueChange={trocarCategoria}>
            <SelectTrigger className="w-full data-[size=default]:h-11" aria-label="Categoria da foto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_CATEGORIA}>Nenhuma</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              {categoriaSumiu && (
                <SelectItem value={item.categoria!}>{item.categoria} (não existe mais)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch
            checked={item.ativo}
            onCheckedChange={alternarAtivo}
            disabled={!item.ativo && semVaga}
            aria-label="No site"
          />
          No site
        </label>

        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={`Subir ${item.legenda}`}
            disabled={primeiro}
            onClick={() => aoMover(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11"
            aria-label={`Descer ${item.legenda}`}
            disabled={ultimo}
            onClick={() => aoMover(1)}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 text-destructive"
            aria-label={`Remover ${item.legenda} da vitrine`}
            onClick={aoRemover}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  )
}

function LegendaNova({
  foto,
  aoFechar,
  aoConfirmar,
}: {
  foto: MidiaPainel | null
  aoFechar: () => void
  /** Devolve a mensagem de erro, ou null se deu certo. */
  aoConfirmar: (legenda: string) => Promise<string | null>
}) {
  const [legenda, setLegenda] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [idAnterior, setIdAnterior] = useState<string | null>(null)

  // sugere a descrição da foto (cortada em 60) quando uma foto nova abre o diálogo
  if ((foto?.id ?? null) !== idAnterior) {
    setIdAnterior(foto?.id ?? null)
    setLegenda((foto?.alt ?? "").slice(0, LEGENDA_MAX))
    setErro(null)
  }

  async function confirmar() {
    const limpa = legenda.trim()

    if (limpa.length < 1 || limpa.length > LEGENDA_MAX) {
      setErro("A legenda precisa ter de 1 a 60 caracteres.")
      return
    }

    setSalvando(true)
    const mensagem = await aoConfirmar(limpa)
    setSalvando(false)

    if (mensagem) setErro(mensagem)
  }

  return (
    <Dialog open={!!foto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Legenda da foto</DialogTitle>
          <DialogDescription>Um texto curto que aparece junto da foto no site.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void confirmar()
          }}
          className="space-y-3"
        >
          <div className="flex gap-3">
            {foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={foto.urlPequena}
                alt={foto.alt}
                width={480}
                height={640}
                className="aspect-[3/4] w-16 shrink-0 rounded-md object-cover"
                style={{ backgroundColor: foto.cor }}
              />
            )}
            <Input
              value={legenda}
              maxLength={LEGENDA_MAX}
              onChange={(e) => {
                setLegenda(e.target.value)
                setErro(null)
              }}
              aria-label="Legenda"
              aria-invalid={!!erro}
              className="h-11"
              autoFocus
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
