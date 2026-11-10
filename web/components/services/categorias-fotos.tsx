"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { CategoriaPainel } from "@/lib/domain/categorias"
import type { MidiaPainel } from "@/contracts/painel/midia"
import { definirFotoDaCategoria, renomearCategoriaAction, reordenarCategoriasAction } from "@/app/actions/categorias"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MediaPicker } from "@/components/midia/media-picker"
import { cn } from "@/lib/utils"

/** Debounce da gravação da ordem (05 §2): subir três posições = uma gravação. */
const ESPERA_ORDEM_MS = 600

const chaveDe = (nome: string) => nome.trim().toLowerCase()

type Props = {
  categorias: CategoriaPainel[]
}

/**
 * Seção "Categorias e fotos" no topo de Serviços (contrato midia-vitrine/05 §2). Só é renderizada para
 * owner/admin (a página decide); as actions recusam `professional` do mesmo jeito.
 */
export function CategoriasFotos({ categorias }: Props) {
  const [aberta, setAberta] = useState(() => categorias.some((c) => !c.foto))
  const [lista, setLista] = useState(categorias)
  const [escolhendo, setEscolhendo] = useState<CategoriaPainel | null>(null)
  const [renomeando, setRenomeando] = useState<CategoriaPainel | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  const listaRef = useRef(lista)
  const confirmada = useRef(categorias)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendente = useRef(false)

  // Depois de cada ação a página revalida e chega lista nova; só adota se não há ordem esperando para gravar.
  const [categoriasAnteriores, setCategoriasAnteriores] = useState(categorias)
  const [ordenando, setOrdenando] = useState(false)

  if (categorias !== categoriasAnteriores) {
    setCategoriasAnteriores(categorias)
    if (!ordenando) setLista(categorias)
  }

  useEffect(() => {
    if (pendente.current) return
    listaRef.current = categorias
    confirmada.current = categorias
  }, [categorias])

  const gravarOrdem = useCallback(async () => {
    temporizador.current = null
    const enviada = listaRef.current
    const resultado = await reordenarCategoriasAction(enviada.map((c) => c.chave))

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
        void reordenarCategoriasAction(listaRef.current.map((c) => c.chave))
      }
    }
  }, [])

  function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta
    if (destino < 0 || destino >= listaRef.current.length) return

    const nova = [...listaRef.current]
    ;[nova[indice], nova[destino]] = [nova[destino], nova[indice]]

    listaRef.current = nova
    pendente.current = true
    setOrdenando(true)
    setLista(nova)

    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(gravarOrdem, ESPERA_ORDEM_MS)
  }

  function trocarFotoLocal(chave: string, foto: MidiaPainel | null) {
    const nova = listaRef.current.map((c) => (c.chave === chave ? { ...c, foto } : c))
    listaRef.current = nova
    confirmada.current = confirmada.current.map((c) => (c.chave === chave ? { ...c, foto } : c))
    setLista(nova)
  }

  async function definirFoto(categoria: CategoriaPainel, foto: MidiaPainel | null) {
    setOcupada(categoria.chave)
    const resultado = await definirFotoDaCategoria(categoria.nome, foto?.id ?? null)
    setOcupada(null)

    if ("error" in resultado) {
      toast.error(resultado.error ?? "Não foi possível trocar a foto.")
      return false
    }

    trocarFotoLocal(categoria.chave, foto)
    toast.success(foto ? "Foto da categoria trocada." : "Foto da categoria removida.")
    return true
  }

  async function aoEscolher(foto: MidiaPainel) {
    if (!escolhendo) return

    const ok = await definirFoto(escolhendo, foto)
    if (ok) setEscolhendo(null)
  }

  return (
    <section aria-labelledby="categorias-fotos-titulo" className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        aria-controls="categorias-fotos-corpo"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left"
      >
        <span>
          <span id="categorias-fotos-titulo" className="block text-base font-semibold text-foreground">
            Categorias e fotos
          </span>
          <span className="block text-sm text-muted-foreground">A ordem e as fotos daqui aparecem no seu site.</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform", aberta && "rotate-180")} />
      </button>

      {aberta && (
        <div id="categorias-fotos-corpo" className="border-t border-border p-3 sm:p-4">
          {lista.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Dê uma categoria aos seus serviços (no botão de editar) para agrupá-los no site.
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {lista.map((categoria, indice) => (
                <li key={categoria.chave} className="flex items-stretch gap-3 rounded-lg border border-border p-3">
                  <div className="w-[60px] shrink-0">
                    {categoria.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={categoria.foto.urlPequena}
                        alt={categoria.foto.alt}
                        width={480}
                        height={640}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[3/4] w-full rounded-md object-cover"
                        style={{ backgroundColor: categoria.foto.cor }}
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="aspect-[3/4] w-full rounded-md border-2 border-dashed border-border bg-muted/40"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{categoria.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {categoria.servicos} {categoria.servicos === 1 ? "serviço" : "serviços"}
                    </p>
                    {!categoria.foto && (
                      <p className="text-xs text-muted-foreground">Sem foto: o site usa a padrão</p>
                    )}

                    <div className="-ml-2 mt-1 flex flex-wrap">
                      <Button
                        type="button"
                        variant="link"
                        className="min-h-11 px-2"
                        disabled={ocupada === categoria.chave}
                        onClick={() => setEscolhendo(categoria)}
                      >
                        {ocupada === categoria.chave && <Loader2 className="animate-spin" />}
                        Trocar foto
                      </Button>
                      {categoria.foto && (
                        <Button
                          type="button"
                          variant="link"
                          className="min-h-11 px-2"
                          disabled={ocupada === categoria.chave}
                          onClick={() => definirFoto(categoria, null)}
                        >
                          Tirar foto
                        </Button>
                      )}
                      <Button type="button" variant="link" className="min-h-11 px-2" onClick={() => setRenomeando(categoria)}>
                        Renomear
                      </Button>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Subir ${categoria.nome}`}
                      disabled={indice === 0}
                      onClick={() => mover(indice, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Descer ${categoria.nome}`}
                      disabled={indice === lista.length - 1}
                      onClick={() => mover(indice, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MediaPicker
        open={!!escolhendo}
        onOpenChange={(v) => !v && setEscolhendo(null)}
        titulo={escolhendo ? `Foto da categoria ${escolhendo.nome}` : "Foto da categoria"}
        selecionadaId={escolhendo?.foto?.id ?? null}
        onEscolher={aoEscolher}
        previaSite
        descreverUsos={(mediaId) => lista.filter((c) => c.foto?.id === mediaId).map((c) => `na categoria ${c.nome}`)}
      />

      <RenomearCategoria
        categoria={renomeando}
        todas={lista}
        aoFechar={() => setRenomeando(null)}
      />
    </section>
  )
}

function RenomearCategoria({
  categoria,
  todas,
  aoFechar,
}: {
  categoria: CategoriaPainel | null
  todas: CategoriaPainel[]
  aoFechar: () => void
}) {
  const [nome, setNome] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [chaveAnterior, setChaveAnterior] = useState<string | null>(null)

  // preenche o campo quando uma categoria nova abre o diálogo
  if ((categoria?.chave ?? null) !== chaveAnterior) {
    setChaveAnterior(categoria?.chave ?? null)
    setNome(categoria?.nome ?? "")
    setErro(null)
  }

  const limpo = nome.trim()
  const existente = categoria ? todas.find((c) => c.chave !== categoria.chave && c.chave === chaveDe(limpo)) : undefined

  async function salvar() {
    if (!categoria) return

    if (limpo.length < 1 || limpo.length > 40) {
      setErro("O nome precisa ter de 1 a 40 caracteres.")
      return
    }

    if (limpo === categoria.nome) {
      aoFechar()
      return
    }

    setSalvando(true)
    const resultado = await renomearCategoriaAction(categoria.nome, limpo)
    setSalvando(false)

    if ("error" in resultado) {
      setErro(resultado.error ?? "Não foi possível renomear a categoria.")
      return
    }

    toast.success("Categoria renomeada.")
    aoFechar()
  }

  return (
    <Dialog open={!!categoria} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear categoria</DialogTitle>
          <DialogDescription>Muda a categoria em todos os serviços dela.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
          className="space-y-3"
        >
          <Input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErro(null)
            }}
            maxLength={40}
            aria-label="Novo nome da categoria"
            aria-invalid={!!erro}
            className="h-11"
            autoFocus
          />

          {existente && (
            <p className="text-sm text-muted-foreground">
              Os serviços vão para a categoria {existente.nome}, que já existe, e vale a foto dela.
            </p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />}
              Renomear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
