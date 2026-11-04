"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { MessageCircleMore } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PropsDoChat } from "./chat-agendamento"

// Só baixa depois do primeiro toque: quem não usa o chat não carrega o chat.
const ChatAgendamento = dynamic(() => import("./chat-agendamento"), { ssr: false })

/** Botão flutuante (contrato 08 §7.2). A conversa fica em memória: fechar e reabrir mantém. */
export function ChatFlutuante(props: Omit<PropsDoChat, "aberto" | "aoFechar" | "devolverFoco">) {
  const [aberto, setAberto] = useState(false)
  const [carregado, setCarregado] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Button
        ref={botao}
        type="button"
        size="lg"
        aria-label="Abrir ajuda para escolher"
        onClick={() => {
          setCarregado(true)
          setAberto(true)
        }}
        className={cn(
          "fixed right-4 z-40 h-12 w-12 rounded-full p-0 shadow-lg bottom-[calc(var(--altura-barra,8rem)+0.75rem)] xl:bottom-6 xl:h-11 xl:w-auto xl:px-4",
          aberto && "hidden"
        )}
      >
        <MessageCircleMore className="h-5 w-5" />
        <span className="hidden xl:inline">Ajuda para escolher</span>
      </Button>

      {carregado && (
        <ChatAgendamento
          {...props}
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          devolverFoco={() => botao.current?.focus()}
        />
      )}
    </>
  )
}
