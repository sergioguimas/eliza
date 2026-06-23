import { redirect } from "next/navigation"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/reset-password?error=recovery_session_invalid")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <ResetPasswordForm />
    </main>
  )
}
