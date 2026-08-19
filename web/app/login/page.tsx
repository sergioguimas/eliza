import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/shared/login-form"
import { ElizaWordmark } from "@/components/shared/eliza-wordmark"
import { SolaSeal } from "@/components/layout/sola-seal"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Login",
  description: "Faça login na sua conta",
}

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-8 left-8">
        <ElizaWordmark withDot />
      </div>

      <Suspense fallback={<div>Carregando...</div>}>
        <LoginForm />
      </Suspense>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <SolaSeal />
      </div>
    </div>
  )
}