import { Metadata } from "next"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { Stethoscope } from "lucide-react"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Login | Eliza",
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
      <div className="absolute top-8 left-8 flex items-center gap-2 text-primary font-bold text-xl">
        <Stethoscope className="h-6 w-6" />
        Eliza
      </div>

      {/* ENVOLVA O FORMULÁRIO COM SUSPENSE */}
      <Suspense fallback={<div>Carregando...</div>}>
        <LoginForm />
      </Suspense>
      
    </div>
  )
}