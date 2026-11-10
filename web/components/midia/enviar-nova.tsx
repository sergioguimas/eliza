"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import type { MidiaPainel } from "@/contracts/painel/midia"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  ALT_MAX,
  ErroEnvio,
  LADO_MENOR_MINIMO,
  LIMITE_FOTOS,
  enviarMidia,
  prepararImagem,
  validarAlt,
  type ImagemPreparada,
} from "./envio-foto"
import type { AreaRecortada } from "./recorte-foto"

// O chunk do react-easy-crop só é pedido quando este componente renderiza <RecorteFoto/>, isto é, depois que a
// pessoa escolheu uma foto. Nada disso entra no JS inicial das páginas.
const RecorteFoto = dynamic(() => import("./recorte-foto"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(58dvh,440px)] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" /> Abrindo o recorte...
    </div>
  ),
})

type Props = {
  /** Biblioteca cheia: o envio fica bloqueado (a rota também recusa). */
  cheia: boolean
  aoEnviar: (foto: MidiaPainel) => void
}

type Preparada = ImagemPreparada & { url: string }

export function EnviarNova({ cheia, aoEnviar }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [preparada, setPreparada] = useState<Preparada | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const [area, setArea] = useState<AreaRecortada | null>(null)
  const [alt, setAlt] = useState("")
  const [tocou, setTocou] = useState(false)
  const [progresso, setProgresso] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // libera a URL temporária da prévia ao trocar de foto e ao fechar o seletor
  useEffect(() => {
    return () => {
      if (preparada) URL.revokeObjectURL(preparada.url)
    }
  }, [preparada])

  const aoMudarArea = useCallback((nova: AreaRecortada) => setArea(nova), [])

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return

    setErro(null)
    setAbrindo(true)
    setArea(null)

    try {
      const pronta = await prepararImagem(arquivo)
      setPreparada({ ...pronta, url: URL.createObjectURL(pronta.blob) })
    } catch (e) {
      setPreparada(null)
      setErro(e instanceof ErroEnvio ? e.message : "Não consegui abrir essa foto. Tente uma em JPG ou PNG.")
    } finally {
      setAbrindo(false)
      if (entrada.current) entrada.current.value = ""
    }
  }

  function recomecar() {
    setPreparada(null)
    setArea(null)
    setErro(null)
    setProgresso(null)
  }

  const enviando = progresso !== null
  const erroAlt = validarAlt(alt)
  const pequena = area !== null && area.larguraPx < LADO_MENOR_MINIMO

  async function enviar() {
    if (!preparada || !area || erroAlt || pequena) {
      setTocou(true)
      return
    }

    setErro(null)
    setProgresso(0)

    try {
      const foto = await enviarMidia({ imagem: preparada.blob, recorte: area.recorte, alt }, setProgresso)
      toast.success("Foto enviada.")
      aoEnviar(foto)
    } catch (e) {
      const mensagem = e instanceof ErroEnvio ? e.message : "Não foi possível enviar a foto. Tente novamente."
      setErro(mensagem)
      toast.error(mensagem)
      setProgresso(null)
    }
  }

  if (cheia) {
    return (
      <div role="alert" className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
        A biblioteca chegou a {LIMITE_FOTOS} fotos. Exclua as que não usa mais (na aba &quot;Minhas fotos&quot;) para enviar uma nova.
      </div>
    )
  }

  if (!preparada) {
    return (
      <div className="space-y-3">
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          id="midia-arquivo"
          onChange={(e) => escolherArquivo(e.target.files?.[0])}
        />

        <label
          htmlFor="midia-arquivo"
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:bg-accent/50 focus-within:ring-2"
        >
          {abrindo ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="size-8 text-muted-foreground" />
          )}
          <span className="text-base font-medium">{abrindo ? "Preparando a foto..." : "Escolher uma foto"}</span>
          <span className="text-sm text-muted-foreground">Da galeria ou da câmera. JPG, PNG ou WebP.</span>
        </label>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RecorteFoto imagem={preparada.url} aoMudar={aoMudarArea} />

      {pequena && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Essa foto é pequena e vai ficar borrada no site. Aproxime menos (zoom) ou escolha uma foto maior.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="midia-alt" className="text-sm font-medium">
          Descreva a foto
        </label>
        <Textarea
          id="midia-alt"
          value={alt}
          rows={2}
          maxLength={ALT_MAX + 50}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => setTocou(true)}
          aria-invalid={tocou && !!erroAlt}
          aria-describedby="midia-alt-ajuda"
          disabled={enviando}
          className="text-base md:text-sm"
        />
        <p id="midia-alt-ajuda" className="text-xs text-muted-foreground">
          Para quem usa leitor de tela e para o Google. Ex.: Unhas amendoadas com francesinha e brilho.
        </p>
        {tocou && erroAlt && <p className="text-xs text-destructive">{erroAlt}</p>}
      </div>

      {enviando && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progresso ?? 0) * 100)}
            aria-label="Progresso do envio"
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round((progresso ?? 0) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {(progresso ?? 0) >= 1 ? "Processando a foto..." : `Enviando... ${Math.round((progresso ?? 0) * 100)}%`}
          </p>
        </div>
      )}

      {erro && !enviando && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className="min-h-11" onClick={recomecar} disabled={enviando}>
          Escolher outra foto
        </Button>
        <Button type="button" className="min-h-11" onClick={enviar} disabled={enviando || pequena || !area}>
          {enviando ? <Loader2 className="animate-spin" /> : null}
          Enviar
        </Button>
      </div>
    </div>
  )
}
