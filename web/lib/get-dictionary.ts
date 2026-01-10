import { dictionaries } from "./dictionaries"

export const getDictionary = (niche: string | null) => {
  // Se o nicho não existir ou for inválido, usa o 'generico'
  // @ts-ignore
  return dictionaries[niche] || dictionaries['generico']
}