import { existsSync, statSync } from "node:fs"
import { dirname, resolve as caminho } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const RAIZ = caminho(dirname(fileURLToPath(import.meta.url)), "..")

function comExtensao(base) {
  for (const final of ["", ".ts", ".tsx", "/index.ts"]) {
    const alvo = base + final

    if (existsSync(alvo) && statSync(alvo).isFile()) return alvo
  }

  return null
}

export async function resolve(especificador, contexto, proximo) {
  if (especificador === "server-only") return { url: "data:text/javascript,", shortCircuit: true }

  if (especificador.startsWith("@/")) {
    const alvo = comExtensao(caminho(RAIZ, especificador.slice(2)))

    if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true }
  }

  if (especificador.startsWith(".") && contexto.parentURL?.startsWith("file:")) {
    const alvo = comExtensao(caminho(dirname(fileURLToPath(contexto.parentURL)), especificador))

    if (alvo) return { url: pathToFileURL(alvo).href, shortCircuit: true }
  }

  return proximo(especificador, contexto)
}
