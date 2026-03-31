import { dictionaries, type NicheDictionary, type NicheType } from "./dictionaries"

export const getDictionary = (
  niche: string | null | undefined
): NicheDictionary => {
  if (!niche) return dictionaries.generico

  if (niche in dictionaries) {
    return dictionaries[niche as NicheType]
  }

  return dictionaries.generico
}