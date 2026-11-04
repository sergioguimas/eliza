// Deixa o `node --test` carregar os módulos do app: resolve o alias `@/`, os
// imports sem extensão e neutraliza `server-only`. Sem dependência nova.
import { register } from "node:module"

register("./resolver.mjs", import.meta.url)
