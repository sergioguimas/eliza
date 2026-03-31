'use client'

import { createContext, useContext } from 'react'
import {
  getNicheMetadata,
  type NicheBrandConfig,
  type NicheId,
  type NicheMetadata,
} from '@/lib/niche-config'
import { dictionaries, type NicheDictionary } from '@/lib/dictionaries'
import { getDictionary } from "@/lib/get-dictionary"

type KeckleonContextType = {
  dict: NicheDictionary
  niche: NicheId
  meta: NicheMetadata
  brand: NicheBrandConfig
  entities: NicheDictionary["entities"]
  nav: NicheDictionary["nav"]
  actions: NicheDictionary["actions"]
  messages: NicheDictionary["messages"]
}

const KeckleonContext = createContext<KeckleonContextType | null>(null)

export function KeckleonProvider({
  children,
  niche,
}: {
  children: React.ReactNode
  niche: string
}) {
  const meta = getNicheMetadata(niche)
  const normalizedNiche = meta.id

  const dict = dictionaries[normalizedNiche] || dictionaries.generico

  return (
    <KeckleonContext.Provider
      value={{
        dict,
        niche: normalizedNiche,
        meta,
        brand: meta.brand,

        // atalhos diretos (isso aqui melhora MUITO o uso no dia a dia)
        entities: dict.entities,
        nav: dict.nav,
        actions: dict.actions,
        messages: dict.messages,
      }}
    >
      {children}
    </KeckleonContext.Provider>
  )
}

export function useKeckleon() {
  const context = useContext(KeckleonContext)

  if (!context) {
    throw new Error('useKeckleon deve ser usado dentro de um KeckleonProvider')
  }

  return context
}