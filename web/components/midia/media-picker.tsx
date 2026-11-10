"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import type { MidiaPainel } from "@/contracts/painel/midia"
import { editarAltMidia, excluirMidia, listarBibliotecaAction } from "@/app/actions/midia"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { EnviarNova } from "./enviar-nova"
import { LIMITE_FOTOS, validarAlt } from "./envio-foto"
import { PreviaSite } from "./previa-site"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Ex.: "Foto da categoria Alongamento" */
  titulo: string
  selecionadaId?: string | null
  onEscolher: (m: MidiaPainel) => void
  /**
   * Onde a foto está em uso, para explicar por que não dá para excluir (ex.: ["na categoria Alongamento", "na vitrine"]).
   * Opcional: sem ele a mensagem é genérica.
   */
  descreverUsos?: (mediaId: string) => string[]
  /** Foto de categoria: mostra "Assim aparece no site" (moldura 4:3, object-position 50% 40%). */
  previaSite?: boolean
}

export function MediaPicker({ open, onOpenChange, titulo, selecionadaId, onEscolher, descreverUsos, previaSite }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle className="text-base">{titulo}</DialogTitle>
          <DialogDescription className="sr-only">Escolha uma foto da biblioteca ou envie uma nova.</DialogDescription>
        </DialogHeader>

        {/* Montado só com o diálogo aberto: o estado (lista, foto em recorte) zera a cada abertura. */}
        <Conteudo selecionadaId={selecionadaId ?? null} onEscolher={onEscolher} descreverUsos={descreverUsos} previaSite={previaSite} />
      </DialogContent>
    </Dialog>
  )
}

function Conteudo({
  selecionadaId,
  onEscolher,
  descreverUsos,
  previaSite,
}: {
  previaSite?: boolean
  selecionadaId: string | null
  onEscolher: (m: MidiaPainel) => void
  descreverUsos?: (mediaId: string) => string[]
}) {
  const [fotos, setFotos] = useState<MidiaPainel[] | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [aba, setAba] = useState<"biblioteca" | "enviar" | null>(null)
  const [sel, setSel] = useState<string | null>(selecionadaId)
  const [editando, setEditando] = useState<MidiaPainel | null>(null)
  const [excluindo, setExcluindo] = useState<MidiaPainel | null>(null)

  useEffect(() => {
    let ativo = true

    listarBibliotecaAction().then((r) => {
      if (!ativo) return

      if ("error" in r) {
        setErroCarga(r.error ?? "Não foi possível carregar as fotos.")
        setAba("enviar")
        return
      }

      setFotos(r.fotos)
      setAba((atual) => atual ?? (r.fotos.length > 0 ? "biblioteca" : "enviar"))
    })

    return () => {
      ativo = false
    }
  }, [])

  const escolhida = fotos?.find((f) => f.id === sel) ?? null

  if (aba === null) {
    return (
      <div className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando as fotos...
      </div>
    )
  }

  function aoEnviar(foto: MidiaPainel) {
    setFotos((atual) => [foto, ...(atual ?? [])])
    setSel(foto.id)
    onEscolher(foto)
  }

  return (
    <>
      <Tabs value={aba} onValueChange={(v) => setAba(v as "biblioteca" | "enviar")} className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-4 mt-3 h-11 w-[calc(100%-2rem)]">
          <TabsTrigger value="biblioteca" className="min-h-9">
            Minhas fotos
          </TabsTrigger>
          <TabsTrigger value="enviar" className="min-h-9">
            Enviar nova
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {erroCarga && <p className="mb-3 text-sm text-destructive">{erroCarga}</p>}

            {fotos && fotos.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Você ainda não enviou nenhuma foto.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {fotos?.map((foto) => {
                  const marcada = foto.id === sel

                  return (
                    <li key={foto.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setSel(foto.id)}
                        aria-pressed={marcada}
                        aria-label={`${marcada ? "Selecionada: " : ""}${foto.alt}`}
                        className={cn(
                          "relative block w-full overflow-hidden rounded-lg border-2 transition-colors",
                          marcada ? "border-primary" : "border-transparent"
                        )}
                        style={{ backgroundColor: foto.cor }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={foto.urlPequena}
                          alt=""
                          width={480}
                          height={640}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[3/4] w-full object-cover"
                        />
                        {marcada && (
                          <span className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-4" />
                          </span>
                        )}
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Opções da foto: ${foto.alt}`}
                            className="absolute -right-1 -top-1 flex size-11 items-center justify-center"
                          >
                            <span className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow">
                              <MoreHorizontal className="size-4" />
                            </span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="min-h-11" onSelect={() => setEditando(foto)}>
                            Editar descrição
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="min-h-11 text-destructive focus:text-destructive"
                            onSelect={() => setExcluindo(foto)}
                          >
                            Excluir da biblioteca
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {previaSite && escolhida && (
            <div className="border-t bg-background px-3 pt-3">
              <PreviaSite src={escolhida.urlPequena} />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t bg-background p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <p className="text-sm text-muted-foreground">
              {fotos?.length ?? 0} de {LIMITE_FOTOS} fotos
            </p>
            <Button className="min-h-11" disabled={!escolhida} onClick={() => escolhida && onEscolher(escolhida)}>
              Usar esta foto
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="enviar" className="min-h-0 flex-1 overflow-y-auto p-4">
          {erroCarga && <p className="mb-3 text-sm text-destructive">{erroCarga}</p>}
          <EnviarNova cheia={(fotos?.length ?? 0) >= LIMITE_FOTOS} aoEnviar={aoEnviar} previaSite={previaSite} />
        </TabsContent>
      </Tabs>

      <EditarDescricao
        foto={editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={(id, alt) => setFotos((atual) => atual?.map((f) => (f.id === id ? { ...f, alt } : f)) ?? null)}
      />

      <ExcluirFoto
        foto={excluindo}
        locais={excluindo ? (descreverUsos?.(excluindo.id) ?? []) : []}
        aoFechar={() => setExcluindo(null)}
        aoExcluir={(id) => {
          setFotos((atual) => atual?.filter((f) => f.id !== id) ?? null)
          setSel((atual) => (atual === id ? null : atual))
        }}
      />
    </>
  )
}

function EditarDescricao({
  foto,
  aoFechar,
  aoSalvar,
}: {
  foto: MidiaPainel | null
  aoFechar: () => void
  aoSalvar: (id: string, alt: string) => void
}) {
  const [alt, setAlt] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [idAnterior, setIdAnterior] = useState<string | null>(null)

  // preenche o campo quando uma foto nova abre o diálogo
  if ((foto?.id ?? null) !== idAnterior) {
    setIdAnterior(foto?.id ?? null)
    setAlt(foto?.alt ?? "")
    setErro(null)
  }

  async function salvar() {
    if (!foto) return

    const invalido = validarAlt(alt)
    if (invalido) {
      setErro(invalido)
      return
    }

    setSalvando(true)
    const r = await editarAltMidia(foto.id, alt.trim())
    setSalvando(false)

    if ("error" in r) {
      setErro(r.error ?? "Não foi possível salvar a descrição.")
      return
    }

    aoSalvar(foto.id, alt.trim())
    toast.success("Descrição salva.")
    aoFechar()
  }

  return (
    <Dialog open={!!foto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar descrição</DialogTitle>
          <DialogDescription>Para quem usa leitor de tela e para o Google.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
          className="space-y-3"
        >
          <Input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            aria-label="Descrição da foto"
            aria-invalid={!!erro}
            className="h-11"
            autoFocus
          />
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ExcluirFoto({
  foto,
  locais,
  aoFechar,
  aoExcluir,
}: {
  foto: MidiaPainel | null
  locais: string[]
  aoFechar: () => void
  aoExcluir: (id: string) => void
}) {
  const [excluindo, setExcluindo] = useState(false)
  const emUso = !!foto && foto.usos > 0

  async function excluir() {
    if (!foto) return

    setExcluindo(true)
    const r = await excluirMidia(foto.id)
    setExcluindo(false)

    if ("error" in r) {
      // CONFLICT/EM_USO chega aqui com a mensagem do domínio (a action só repassa `message`, sem `detalhes`)
      toast.error(r.error ?? "Não foi possível excluir a foto.")
      aoFechar()
      return
    }

    aoExcluir(foto.id)
    toast.success("Foto excluída da biblioteca.")
    aoFechar()
  }

  return (
    <AlertDialog open={!!foto} onOpenChange={(v) => !v && aoFechar()}>
      <AlertDialogContent className="max-w-[calc(100%-1rem)] sm:max-w-md">
        {emUso ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Essa foto está em uso</AlertDialogTitle>
              <AlertDialogDescription>
                {locais.length > 0
                  ? `Ela está ${listar(foto && foto.usos > locais.length ? [...locais, "em outro lugar (categoria ou vitrine)"] : locais)}. Troque a foto lá antes de excluir.`
                  : "Ela está numa categoria ou na vitrine. Troque a foto lá antes de excluir."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">Entendi</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir da biblioteca?</AlertDialogTitle>
              <AlertDialogDescription>A foto sai da biblioteca. Isso não pode ser desfeito pelo painel.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11" disabled={excluindo}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11"
                disabled={excluindo}
                onClick={(e) => {
                  e.preventDefault()
                  excluir()
                }}
              >
                {excluindo && <Loader2 className="animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function listar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ""
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
}
