"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  CHAT_TEXTO_MAX,
  type AcaoPreencherAgendamento,
  type ChatWebResposta,
  type FormularioChat,
} from "@/contracts/autoatendimento"
import { cn } from "@/lib/utils"

export type ResultadoDaAcao = { linhas: string[] }

export type PropsDoChat = {
  slug: string
  organizacao: string
  aberto: boolean
  aoFechar: () => void
  devolverFoco: () => void
  lerFormulario: () => FormularioChat
  aplicarAcao: (acao: AcaoPreencherAgendamento) => Promise<ResultadoDaAcao>
}

type Fala = { de: "agente" | "cliente" | "sistema"; texto: string }

const ABERTURA = "Oi! Posso ajudar você a escolher o serviço, o profissional e o horário. Quem confirma é você, no formulário."
const SUGESTOES = ["Quais serviços vocês têm?", "Qual o próximo horário livre?", "Me ajuda a escolher"]
const CONTADOR_A_PARTIR_DE = 400
const ERRO_LIMITE = "Muitas mensagens seguidas. Tente de novo em alguns minutos, ou continue pelo formulário."
const ERRO_GERAL = "Não consegui responder agora. Você pode continuar pelo formulário."

export default function ChatAgendamento({ slug, organizacao, aberto, aoFechar, devolverFoco, lerFormulario, aplicarAcao }: PropsDoChat) {
  const [falas, setFalas] = useState<Fala[]>([{ de: "agente", texto: ABERTURA }])
  const [texto, setTexto] = useState("")
  const [esperando, setEsperando] = useState(false)
  const [preencheu, setPreencheu] = useState(false)
  const [alvo, setAlvo] = useState<HTMLDivElement | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" })
  }, [falas.length, esperando])

  useEffect(() => {
    if (aberto && !esperando) campo.current?.focus()
  }, [aberto, esperando])

  async function enviar(mensagem: string) {
    const limpa = mensagem.trim()

    if (!limpa || esperando) return

    setTexto("")
    setFalas((f) => [...f, { de: "cliente", texto: limpa }])
    setEsperando(true)

    try {
      const r = await fetch(`/api/marcar/${encodeURIComponent(slug)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: limpa, formulario: lerFormulario() }),
      })
      const corpo = (await r.json().catch(() => null)) as { data?: ChatWebResposta; error?: { code?: string } } | null

      if (!r.ok || !corpo?.data) {
        const erro = corpo?.error?.code === "RATE_LIMITED" ? ERRO_LIMITE : ERRO_GERAL

        setFalas((f) => [...f, { de: "sistema", texto: erro }])
        return
      }

      const { resposta, acoes } = corpo.data

      setFalas((f) => [...f, { de: "agente", texto: resposta }])

      for (const acao of acoes) {
        const { linhas } = await aplicarAcao(acao)

        setPreencheu(true)
        setFalas((f) => [...f, ...linhas.map((l): Fala => ({ de: "sistema", texto: l }))])
      }
    } catch {
      setFalas((f) => [...f, { de: "sistema", texto: ERRO_GERAL }])
    } finally {
      setEsperando(false)
    }
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void enviar(texto)
    }
  }

  return (
    <>
      {/* O portal fica aqui dentro para herdar as cores do tema da página. */}
      <div ref={setAlvo} />
      <Dialog.Root open={aberto} onOpenChange={(v) => !v && aoFechar()}>
        <Dialog.Portal container={alvo}>
          <Dialog.Content
            aria-describedby="chat-aviso"
            aria-modal="true"
            onOpenAutoFocus={(e) => {
              // Sem isto o foco cai em "Fechar", e o primeiro espaço digitado fecha o chat.
              e.preventDefault()
              campo.current?.focus()
            }}
            onCloseAutoFocus={(e) => {
              // Quem abriu foi o botão, que some enquanto o chat está aberto: o padrão não acha para onde voltar.
              e.preventDefault()
              devolverFoco()
            }}
            className="fixed inset-0 z-50 flex h-dvh flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-foreground xl:inset-auto xl:bottom-6 xl:right-6 xl:h-[560px] xl:w-[380px] xl:rounded-2xl xl:border xl:border-border xl:shadow-xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <Dialog.Title className="truncate font-semibold">{organizacao}</Dialog.Title>
                <p className="text-xs text-muted-foreground">Assistente automático</p>
                <p id="chat-aviso" className="mt-1 text-xs text-muted-foreground">
                  Não informe CPF, documentos ou dados de saúde aqui. Seus dados são pedidos só no formulário.
                </p>
              </div>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </header>

            <div role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
              {falas.map((f, i) =>
                f.de === "sistema" ? (
                  <p key={i} className="text-center text-xs text-muted-foreground">
                    {f.texto}
                  </p>
                ) : (
                  <div key={i} className={cn("flex", f.de === "cliente" && "justify-end")}>
                    <p
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                        f.de === "cliente" ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      {f.texto}
                    </p>
                  </div>
                )
              )}

              {falas.length === 1 && (
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => (
                    <Button key={s} type="button" variant="outline" size="sm" onClick={() => enviar(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              )}

              {esperando && <p className="text-sm text-muted-foreground">digitando…</p>}

              {preencheu && !esperando && (
                <div className="flex justify-center">
                  <Button type="button" size="sm" onClick={aoFechar}>
                    Ver no formulário
                  </Button>
                </div>
              )}
              <div ref={fim} />
            </div>

            <div className="space-y-1 border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={campo}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={aoTeclar}
                  maxLength={CHAT_TEXTO_MAX}
                  rows={1}
                  disabled={esperando}
                  placeholder="Escreva sua dúvida"
                  aria-label="Sua mensagem"
                  className="max-h-28 min-h-11 resize-none"
                />
                <Button type="button" size="icon" className="h-11 w-11 shrink-0" aria-label="Enviar" disabled={esperando || !texto.trim()} onClick={() => enviar(texto)}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {texto.length > CONTADOR_A_PARTIR_DE && (
                <p className="text-right text-xs text-muted-foreground">
                  {texto.length}/{CHAT_TEXTO_MAX}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
