"use server"

import { createClient } from "@/utils/supabase/server"
import { getAppUrl } from "@/lib/app-url"
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/validation"

export async function requestPasswordReset(formData: FormData) {
  const rawEmail = String(formData.get("email") || "")
  const email = normalizeEmail(rawEmail)

  if (!email) {
    return { error: "Informe seu e-mail." }
  }

  if (!isValidEmail(email)) {
    return { error: "Informe um e-mail válido." }
  }

  const supabase = await createClient()
  const appUrl = await getAppUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  })

  if (error) {
    console.error("[requestPasswordReset]", error)

    // Evita revelar se o e-mail existe ou não.
    return {
      success:
        "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
    }
  }

  return {
    success:
      "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
  }
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "")
  const confirmPassword = String(formData.get("confirmPassword") || "")

  if (!password || !confirmPassword) {
    return { error: "Preencha a nova senha e a confirmação." }
  }

  if (password !== confirmPassword) {
    return { error: "As senhas não conferem." }
  }

  const passwordError = validatePassword(password)

  if (passwordError) {
    return { error: passwordError }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      error:
        "Sessão de recuperação inválida ou expirada. Solicite um novo link de recuperação.",
    }
  }

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    console.error("[updatePassword]", error)
    return { error: "Não foi possível atualizar a senha." }
  }

  return {
    success: "Senha atualizada com sucesso.",
  }
}
