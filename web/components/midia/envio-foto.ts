/**
 * Lado do navegador do envio de foto (contrato midia-vitrine/05 §1): decodifica, reduz para 2560 px e envia por
 * XMLHttpRequest (fetch não dá progresso de upload). Sem dependência de zod de propósito: o painel não carrega
 * o zod hoje, e os limites abaixo repetem os de `contracts/painel/midia.ts` (a rota é quem decide de verdade).
 */
import type { MidiaPainel } from "@/contracts/painel/midia"

/** Espelham TAMANHO_MAXIMO_BYTES, LIMITE_FOTOS_ATIVAS e AltMidia de contracts/painel/midia.ts. */
export const TAMANHO_MAXIMO = 8_388_608
export const LIMITE_FOTOS = 80
export const ALT_MIN = 3
export const ALT_MAX = 200
export const LADO_MAXIMO = 2560
export const LADO_MENOR_MINIMO = 480

/** Mesmas mensagens de AltMidia; null = válido. */
export function validarAlt(texto: string): string | null {
  const alt = texto.trim()
  if (alt.length < ALT_MIN) return "Descreva a foto em pelo menos 3 caracteres."
  if (alt.length > ALT_MAX) return "A descrição pode ter até 200 caracteres."
  return null
}

export type Recorte = { x: number; y: number; largura: number; altura: number }

export type ImagemPreparada = { blob: Blob; largura: number; altura: number }

export class ErroEnvio extends Error {
  /** Código do envelope (MEDIA_LIMIT_REACHED, RATE_LIMITED...) ou "REDE" / "ABRIR". */
  codigo: string

  constructor(codigo: string, mensagem: string) {
    super(mensagem)
    this.name = "ErroEnvio"
    this.codigo = codigo
  }
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade))
}

/**
 * Abre a foto (a orientação do EXIF é aplicada aqui), reduz para no máximo 2560 px no lado maior e reescreve em
 * JPEG 0,9 (MV8). Isso também resolve o HEIC no Safari, que decodifica. Se mesmo assim passar de 8 MB (foto muito
 * "granulada"), baixa a qualidade e, em último caso, o tamanho, até caber.
 */
export async function prepararImagem(arquivo: File): Promise<ImagemPreparada> {
  let bitmap: ImageBitmap

  try {
    bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" })
  } catch {
    throw new ErroEnvio("ABRIR", "Não consegui abrir essa foto. Tente uma em JPG ou PNG.")
  }

  try {
    let escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))

    for (let tentativa = 0; tentativa < 4; tentativa++) {
      const largura = Math.max(1, Math.round(bitmap.width * escala))
      const altura = Math.max(1, Math.round(bitmap.height * escala))

      const canvas = document.createElement("canvas")
      canvas.width = largura
      canvas.height = altura

      const ctx = canvas.getContext("2d")
      if (!ctx) throw new ErroEnvio("ABRIR", "Não consegui abrir essa foto. Tente uma em JPG ou PNG.")

      // PNG com transparência viraria preto no JPEG
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, largura, altura)
      ctx.drawImage(bitmap, 0, 0, largura, altura)

      for (const qualidade of [0.9, 0.8, 0.7]) {
        const blob = await paraBlob(canvas, qualidade)
        if (!blob) throw new ErroEnvio("ABRIR", "Não consegui abrir essa foto. Tente uma em JPG ou PNG.")
        if (blob.size <= TAMANHO_MAXIMO) return { blob, largura, altura }
      }

      escala *= 0.75
    }

    throw new ErroEnvio("ABRIR", "Essa foto é pesada demais. Escolha uma menor.")
  } finally {
    bitmap.close()
  }
}

type RespostaErro = { error?: { code?: string; message?: string } }

function mensagemDoErro(status: number, codigo: string, mensagemServidor: string | undefined, retryAfter: number | null) {
  if (status === 429 || codigo === "RATE_LIMITED") {
    if (retryAfter !== null && retryAfter < 60) return "O servidor está ocupado. Tente de novo em alguns segundos."

    const minutos = Math.max(1, Math.ceil((retryAfter ?? 3600) / 60))
    return `Muitos envios seguidos. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`
  }

  if (status === 415) return "Esse tipo de arquivo não é aceito. Use uma foto em JPG, PNG ou WebP."
  if (status === 413 || codigo === "MEDIA_TOO_LARGE") return mensagemServidor || "A foto passa de 8 MB. Escolha uma menor."
  if (status === 401) return "Sua sessão expirou. Entre novamente."
  if (codigo === "MEDIA_LIMIT_REACHED") return mensagemServidor || "A biblioteca chegou a 80 fotos. Exclua as que não usa mais."

  return mensagemServidor || "Não foi possível enviar a foto. Tente novamente."
}

/** POST /api/painel/midia com progresso de envio (0..1). Rejeita com `ErroEnvio` e a mensagem já pronta para a tela. */
export function enviarMidia(
  dados: { imagem: Blob; recorte: Recorte; alt: string },
  aoProgredir: (fracao: number) => void
): Promise<MidiaPainel> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("arquivo", dados.imagem, "foto.jpg")
    form.append("recorte", JSON.stringify(dados.recorte))
    form.append("alt", dados.alt.trim())

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/painel/midia")
    xhr.responseType = "text"

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable && evento.total > 0) aoProgredir(evento.loaded / evento.total)
    }

    xhr.onerror = () => reject(new ErroEnvio("REDE", "Sem conexão. Confira a internet e tente de novo."))
    xhr.ontimeout = () => reject(new ErroEnvio("REDE", "O envio demorou demais. Confira a internet e tente de novo."))

    xhr.onload = () => {
      let corpo: unknown = null

      try {
        corpo = JSON.parse(xhr.responseText)
      } catch {
        // resposta que não é JSON cai na mensagem genérica abaixo
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const midia = (corpo as { data?: MidiaPainel } | null)?.data

        if (midia && typeof midia.id === "string") {
          aoProgredir(1)
          resolve(midia)
          return
        }
      }

      const erro = (corpo as RespostaErro | null)?.error
      const retry = Number(xhr.getResponseHeader("Retry-After"))

      reject(
        new ErroEnvio(
          erro?.code ?? "DESCONHECIDO",
          mensagemDoErro(xhr.status, erro?.code ?? "", erro?.message, Number.isFinite(retry) && retry > 0 ? retry : null)
        )
      )
    }

    xhr.send(form)
  })
}
