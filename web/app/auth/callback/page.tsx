"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/utils/supabase/client"

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/reset-password"
  }

  return value
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function completeRecovery() {
      const currentUrl = new URL(window.location.href)
      const code = currentUrl.searchParams.get("code")
      const nextPath = getSafeNextPath(currentUrl.searchParams.get("next"))
      const hashParams = new URLSearchParams(currentUrl.hash.slice(1))
      const supabase = createClient()
      let error: Error | null = null

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code)
        error = result.error
      } else {
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")

        if (accessToken && refreshToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          error = result.error
        } else {
          const result = await supabase.auth.getSession()

          if (!result.data.session) {
            error = new Error("Sessão de recuperação não encontrada.")
          }
        }
      }

      if (error) {
        console.error("[AuthCallbackPage]", error)
        router.replace("/forgot-password?error=recovery_link_invalid")
        return
      }

      router.replace(nextPath)
      router.refresh()
    }

    void completeRecovery()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <p className="text-sm text-muted-foreground">
        Validando seu link de acesso...
      </p>
    </main>
  )
}
