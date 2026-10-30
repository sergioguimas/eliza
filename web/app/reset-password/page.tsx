import { redirect } from "next/navigation"

// Rota antiga, mantida só para links já enviados: era uma cópia de
// /forgot-password, e a definição da nova senha mora em /update-password.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  redirect(
    error
      ? `/forgot-password?error=${encodeURIComponent(error)}`
      : "/forgot-password"
  )
}
