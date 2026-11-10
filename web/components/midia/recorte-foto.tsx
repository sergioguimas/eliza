"use client"

/**
 * Recorte 3:4 com react-easy-crop. Este arquivo é o ÚNICO que importa a biblioteca e só é carregado por
 * `next/dynamic` dentro da aba "Enviar nova" (contrato midia-vitrine/05 §4): o chunk não entra no JS inicial
 * de nenhuma página.
 */
import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"

import type { Recorte } from "./envio-foto"

export type AreaRecortada = {
  /** Frações 0..1 da imagem enviada (o campo `recorte` da rota). */
  recorte: Recorte
  /** Largura do recorte em pixels da imagem enviada, para o aviso de foto pequena. */
  larguraPx: number
}

type Props = {
  imagem: string
  aoMudar: (area: AreaRecortada) => void
}

const limita = (n: number) => Math.min(1, Math.max(0, n))

export default function RecorteFoto({ imagem, aoMudar }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  const aoCompletar = useCallback(
    (porcentagem: Area, pixels: Area) => {
      const x = limita(porcentagem.x / 100)
      const y = limita(porcentagem.y / 100)

      aoMudar({
        recorte: {
          x,
          y,
          largura: Math.min(limita(porcentagem.width / 100), 1 - x),
          altura: Math.min(limita(porcentagem.height / 100), 1 - y),
        },
        larguraPx: pixels.width,
      })
    },
    [aoMudar]
  )

  return (
    <div className="space-y-3">
      <div className="relative h-[min(58dvh,440px)] w-full overflow-hidden rounded-lg bg-black touch-none">
        <Cropper
          image={imagem}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4}
          minZoom={1}
          maxZoom={4}
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={aoCompletar}
        />
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm text-muted-foreground">
        <span className="shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom da foto"
          className="h-11 w-full accent-primary"
        />
      </label>
    </div>
  )
}
