import { dictionaries, type NicheDictionary, type NicheType } from "./dictionaries"

function isNicheType(value: string): value is NicheType {
  return value in dictionaries
}

export const getDictionary = (
  niche?: string | null
): NicheDictionary => {
  if (!niche) return dictionaries.generico

  if (isNicheType(niche)) {
    return dictionaries[niche]
  }

  return dictionaries.generico
}