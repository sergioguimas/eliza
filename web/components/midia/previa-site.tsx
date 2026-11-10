import type { Recorte } from "./envio-foto"

/**
 * "Assim aparece no site": a ilha da LP mostra a foto 3:4 numa moldura 4:3 (celular), com object-fit: cover e
 * object-position 50% 40%. Só CSS, sem recorte novo. Decisão do Opus (relatório F2).
 */
export function PreviaSite({ src, recorte }: { src: string; recorte?: Recorte }) {
  return (
    <figure className="w-36 shrink-0 space-y-1">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        {recorte ? (
          // Região recortada (3:4) dentro da moldura 4:3: a faixa visível é a de object-position 50% 40%.
          <div className="absolute left-0 w-full overflow-hidden" style={{ top: "-31.11%", height: "177.78%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="absolute max-w-none"
              style={{
                width: `${100 / recorte.largura}%`,
                left: `${(-recorte.x / recorte.largura) * 100}%`,
                top: `${(-recorte.y / recorte.altura) * 100}%`,
              }}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: "50% 40%" }} />
        )}
      </div>
      <figcaption className="text-xs text-muted-foreground">Assim aparece no site</figcaption>
    </figure>
  )
}
