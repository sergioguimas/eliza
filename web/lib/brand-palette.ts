// Paletas de cor que a organização pode escolher no lugar da cor do nicho.
// A cor de verdade mora em app/globals.css (`.palette-<id>`, clara e escura); aqui ficam só o id
// (o mesmo do CHECK de organizations.brand_palette), o nome e a amostra do seletor.
export const BRAND_PALETTES = [
  { id: "grafite", label: "Grafite", swatch: "#4a4f57" },
  { id: "salvia", label: "Sálvia", swatch: "#4a6356" },
  { id: "areia", label: "Areia", swatch: "#6a5a4d" },
] as const

export type BrandPaletteId = (typeof BRAND_PALETTES)[number]["id"]

export function isBrandPalette(value: unknown): value is BrandPaletteId {
  return BRAND_PALETTES.some((p) => p.id === value)
}

/** Classe CSS da paleta, para ir junto de `theme-<nicho>` no mesmo elemento. Vazia = cor do nicho. */
export function paletteClass(value: string | null | undefined): string {
  return isBrandPalette(value) ? `palette-${value}` : ""
}
