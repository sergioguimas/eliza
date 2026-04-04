import { baseDictionary } from "./base"
import { nicheDictionaries } from "./niches"

export type DictionarySection = Record<string, string>

export type DictionaryShape = {
  niche_label?: string
  icon_set?: string

  entities: DictionarySection
  nav: DictionarySection
  actions: DictionarySection
  ui: DictionarySection
  fields: DictionarySection
  financial: DictionarySection
  messages: DictionarySection
  sections: DictionarySection
}

export type NicheType = keyof typeof nicheDictionaries

function mergeDictionary(
  base: DictionaryShape,
  niche: Partial<DictionaryShape>
): DictionaryShape {
  return {
    ...base,
    ...niche,

    entities: {
      ...base.entities,
      ...niche.entities,
    },

    nav: {
      ...base.nav,
      ...niche.nav,
    },

    actions: {
      ...base.actions,
      ...niche.actions,
    },

    ui: {
      ...base.ui,
      ...niche.ui,
    },

    fields: {
      ...base.fields,
      ...niche.fields,
    },

    financial: {
      ...base.financial,
      ...niche.financial,
    },

    messages: {
      ...base.messages,
      ...niche.messages,
    },

    sections: {
      ...base.sections,
      ...niche.sections,
    },
  }
}

const base = baseDictionary as unknown as DictionaryShape

export const dictionaries: Record<NicheType, DictionaryShape> = Object.fromEntries(
  Object.entries(nicheDictionaries).map(([key, niche]) => [
    key,
    mergeDictionary(base, niche as Partial<DictionaryShape>),
  ])
) as Record<NicheType, DictionaryShape>

export type NicheDictionary = DictionaryShape