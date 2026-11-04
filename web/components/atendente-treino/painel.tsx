"use client"

import { useState } from "react"
import { BookOpen, GraduationCap, History, MessageSquareText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RespostaEncerrar } from "@/contracts/autoatendimento"
import { AbaAprendi } from "./aba-aprendi"
import { AbaNotas } from "./aba-notas"
import { AbaTreinar, type Fala } from "./aba-treinar"
import { AbaVersoes } from "./aba-versoes"

/** Estado da conversa. Fica aqui, acima das abas (contrato 10 §5.1). */
export type EstadoDoTreino = {
  sessaoId: string | null
  falas: Fala[]
  sugerirEncerrar: boolean
  resultado: RespostaEncerrar | null
}

export function PainelDeTreino() {
  // O TabsContent desmonta a aba inativa (Radix): o chat tem de viver acima
  // delas, senão trocar de aba apaga a conversa. Cada aba de leitura recarrega ao
  // voltar, e assim mostra o que o treino acabou de mudar.
  const [treino, setTreino] = useState<EstadoDoTreino>({ sessaoId: null, falas: [], sugerirEncerrar: false, resultado: null })
  const [aba, setAba] = useState("treinar")

  return (
    <Tabs value={aba} onValueChange={setAba} className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="treinar" className="gap-2">
          <MessageSquareText className="h-4 w-4" /> Treinar
        </TabsTrigger>
        <TabsTrigger value="aprendi" className="gap-2">
          <GraduationCap className="h-4 w-4" /> O que aprendi
        </TabsTrigger>
        <TabsTrigger value="versoes" className="gap-2">
          <History className="h-4 w-4" /> Versões
        </TabsTrigger>
        <TabsTrigger value="notas" className="gap-2">
          <BookOpen className="h-4 w-4" /> Notas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="treinar">
        <AbaTreinar estado={treino} aoMudar={setTreino} aoVerNotas={() => setAba("notas")} />
      </TabsContent>
      <TabsContent value="aprendi">
        <AbaAprendi />
      </TabsContent>
      <TabsContent value="versoes">
        <AbaVersoes aoVerAprendi={() => setAba("aprendi")} />
      </TabsContent>
      <TabsContent value="notas">
        <AbaNotas />
      </TabsContent>
    </Tabs>
  )
}
