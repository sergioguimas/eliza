"use client"

import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { abrirSessaoTreino, encerrarSessaoTreino, enviarMensagemTreino } from "@/app/actions/atendente-treino"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TEXTO_TREINO_MAX, type RespostaEncerrar } from "@/contracts/autoatendimento"
import { cn } from "@/lib/utils"
import { descreverMudanca, descreverPadrao, TEXTO_DO_ERRO } from "./descrever"
import type { EstadoDoTreino } from "./painel"

export type Fala = { de: "agens" | "operador"; texto: string }

export function AbaTreinar({
  estado,
  aoMudar,
  aoVerNotas,
}: {
  estado: EstadoDoTreino
  aoMudar: Dispatch<SetStateAction<EstadoDoTreino>>
  aoVerNotas: () => void
}) {
  const [texto, setTexto] = useState("")
  const [ocupado, setOcupado] = useState<"abrindo" | "enviando" | "encerrando" | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" })
  }, [estado.falas.length, ocupado])

  useEffect(() => {
    if (ocupado === null && estado.sessaoId) campo.current?.focus()
  }, [ocupado, estado.sessaoId])

  async function comecar() {
    setOcupado("abrindo")
    const r = await abrirSessaoTreino()
    setOcupado(null)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    aoMudar({
      sessaoId: r.dados.sessaoId,
      falas: [{ de: "agens", texto: r.dados.resposta }],
      sugerirEncerrar: false,
      resultado: null,
    })
  }

  async function enviar() {
    const mensagem = texto.trim()

    if (!mensagem || !estado.sessaoId || ocupado) return

    setTexto("")
    aoMudar((e) => ({ ...e, falas: [...e.falas, { de: "operador", texto: mensagem }] }))
    setOcupado("enviando")
    const r = await enviarMensagemTreino(estado.sessaoId, mensagem)
    setOcupado(null)

    if (!r.ok) {
      // A mensagem não ficou no agens: devolve ao campo para reenviar sem digitar.
      aoMudar((e) => ({ ...e, falas: e.falas.slice(0, -1) }))
      setTexto(mensagem)
      return void toast.error(TEXTO_DO_ERRO[r.erro])
    }

    aoMudar((e) => ({
      ...e,
      falas: [...e.falas, { de: "agens", texto: r.dados.resposta }],
      sugerirEncerrar: r.dados.sugerirEncerrar,
    }))
  }

  async function encerrar() {
    if (!estado.sessaoId) return

    setOcupado("encerrando")
    const r = await encerrarSessaoTreino(estado.sessaoId)
    setOcupado(null)

    if (!r.ok) return void toast.error(TEXTO_DO_ERRO[r.erro])

    aoMudar({ sessaoId: null, falas: [], sugerirEncerrar: false, resultado: r.dados })
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void enviar()
    }
  }

  if (!estado.sessaoId) {
    return (
      <div className="space-y-4">
        {estado.resultado && <Resultado resultado={estado.resultado} aoVerNotas={aoVerNotas} />}
        <Card>
          <CardHeader>
            <CardTitle>{estado.resultado ? "Treinar de novo" : "Como funciona"}</CardTitle>
            <CardDescription className="max-w-prose">
              O atendente vai fazer de conta que é um cliente. Responda como você responderia de verdade, do seu jeito.{" "}
              <strong className="text-foreground">Não use dados reais de clientes.</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={comecar} disabled={ocupado !== null}>
              {ocupado === "abrindo" && <Loader2 className="h-4 w-4 animate-spin" />}
              Começar treino
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const restante = TEXTO_TREINO_MAX - texto.length

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div role="log" aria-live="polite" aria-label="Conversa de treino" className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {estado.falas.map((f, i) => (
            <div key={i} className={cn("flex", f.de === "operador" && "justify-end")}>
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                  f.de === "operador" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {f.texto}
              </p>
            </div>
          ))}
          {ocupado === "enviando" && <p className="text-sm text-muted-foreground">digitando…</p>}
          <div ref={fim} />
        </div>

        <div className="space-y-2">
          <Textarea
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            maxLength={TEXTO_TREINO_MAX}
            rows={2}
            disabled={ocupado !== null}
            placeholder="Responda como você responderia ao cliente"
            aria-label="Sua resposta"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {restante} caracteres · Enter envia, Shift+Enter quebra a linha
            </span>
            <div className="flex gap-2">
              <Button
                variant={estado.sugerirEncerrar ? "default" : "outline"}
                onClick={encerrar}
                disabled={ocupado !== null}
              >
                {ocupado === "encerrando" && <Loader2 className="h-4 w-4 animate-spin" />}
                Encerrar e aprender
              </Button>
              <Button
                variant={estado.sugerirEncerrar ? "outline" : "default"}
                onClick={enviar}
                disabled={ocupado !== null || !texto.trim()}
              >
                <Send className="h-4 w-4" /> Enviar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Resultado({ resultado, aoVerNotas }: { resultado: RespostaEncerrar; aoVerNotas: () => void }) {
  if (resultado.extracaoPendente) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Treino encerrado</CardTitle>
          <CardDescription>Ainda estou processando; volte em alguns minutos.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { mudancas, aguardandoEvidencia, notasNovas } = resultado
  const nadaNovo = !mudancas.length && !aguardandoEvidencia.length && !notasNovas.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treino encerrado</CardTitle>
        {nadaNovo && <CardDescription>Nada novo desta vez.</CardDescription>}
      </CardHeader>
      {!nadaNovo && (
        <CardContent className="space-y-4 text-sm">
          {mudancas.length > 0 && (
            <section>
              <h3 className="font-medium">Aprendi</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {mudancas.map((m) => (
                  <li key={m.campo}>{descreverMudanca(m)}</li>
                ))}
              </ul>
            </section>
          )}
          {aguardandoEvidencia.length > 0 && (
            <section>
              <h3 className="font-medium">Ainda confirmando</h3>
              <p className="text-muted-foreground">Vi uma vez, preciso ver de novo em outro treino.</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {aguardandoEvidencia.map((a) => (
                  <li key={`${a.campo}:${a.valor}`}>{descreverPadrao(a.campo, a.valor)}</li>
                ))}
              </ul>
            </section>
          )}
          {notasNovas.length > 0 && (
            <section>
              <h3 className="font-medium">Fatos para você decidir</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {notasNovas.map((n) => (
                  <li key={n.id}>{n.texto}</li>
                ))}
              </ul>
              <Button variant="link" className="h-auto p-0" onClick={aoVerNotas}>
                Ver notas
              </Button>
            </section>
          )}
        </CardContent>
      )}
    </Card>
  )
}
