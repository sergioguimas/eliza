'use client'

import { createContext, useContext } from 'react'

// Define o formato do contexto
type KeckleonContextType = {
  dict: any // Ou use o tipo inferido do dictionaries.ts para autocomplete top
  niche: string
}

const KeckleonContext = createContext<KeckleonContextType | null>(null)

export function KeckleonProvider({ 
  children, 
  dictionary, 
  niche 
}: { 
  children: React.ReactNode
  dictionary: any
  niche: string
}) {
  return (
    <KeckleonContext.Provider value={{ dict: dictionary, niche }}>
      {children}
    </KeckleonContext.Provider>
  )
}

// Hook personalizado para usar fácil: const { dict } = useKeckleon()
export function useKeckleon() {
  const context = useContext(KeckleonContext)
  if (!context) {
    throw new Error('useKeckleon deve ser usado dentro de um KeckleonProvider')
  }
  return context
}