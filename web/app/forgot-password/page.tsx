import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

// Os links de recuperação que falham (expirado, já usado, substituído por um
// pedido mais novo) voltam para cá. Sem o aviso, a pessoa via só o formulário
// de e-mail de novo e achava que o link "não fazia nada".
const ERROR_MESSAGES: Record<string, string> = {
  recovery_link_invalid:
    "Este link de recuperação é inválido ou já expirou. Peça um novo abaixo — vale só o link do e-mail mais recente.",
  recovery_session_invalid:
    "Sua sessão de recuperação expirou. Peça um novo link abaixo.",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <ForgotPasswordForm errorMessage={errorMessage} />
    </main>
  )
}
