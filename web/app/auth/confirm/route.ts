import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/utils/supabase/server"

// Destino dos links de e-mail do Supabase Auth (template "Reset Password").
// O template manda `token_hash` em vez do `?code=` do PKCE: o code só troca
// por sessão no mesmo navegador que pediu o link (o code verifier fica num
// cookie dele), então abrir o e-mail no celular ou em outra aba anônima caía
// em /forgot-password sem explicação. O token_hash valida aqui no servidor,
// de qualquer aparelho.
//
// Template esperado no painel (Auth → Email Templates → Reset Password):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery

const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "invite", "magiclink", "email"]

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/update-password"
  }

  return value
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const nextPath = getSafeNextPath(searchParams.get("next"))

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.url))
    }

    console.error("[auth/confirm]", error)
  }

  return NextResponse.redirect(
    new URL("/forgot-password?error=recovery_link_invalid", request.url)
  )
}
