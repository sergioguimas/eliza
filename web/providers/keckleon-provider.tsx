'use client'

import { createContext, useContext } from 'react'
import {
  getNicheMetadata,
  type NicheBrandConfig,
  type NicheId,
  type NicheMetadata,
} from '@/lib/niche-config'
import { type NicheDictionary } from '@/lib/dictionaries/dictionaries'
import { getDictionary } from '@/lib/dictionaries/get-dictionary'

type KeckleonContextType = {
  dict: NicheDictionary
  niche: NicheId
  meta: NicheMetadata
  brand: NicheBrandConfig

  entities: NicheDictionary['entities']
  nav: NicheDictionary['nav']
  actions: NicheDictionary['actions']
  ui: NicheDictionary['ui']
  fields: NicheDictionary['fields']
  financial: NicheDictionary['financial']
  messages: NicheDictionary['messages']
  sections: NicheDictionary['sections']
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
  const dict = getDictionary(normalizedNiche)

  return (
    <KeckleonContext.Provider
      value={{
        dict,
        niche: normalizedNiche,
        meta,
        brand: meta.brand,

        entities: dict.entities,
        nav: dict.nav,
        actions: dict.actions,
        ui: dict.ui,
        fields: dict.fields,
        financial: dict.financial,
        messages: dict.messages,
        sections: dict.sections,
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