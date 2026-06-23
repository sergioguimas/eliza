"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock } from "lucide-react"

import { updatePassword } from "@/app/actions/password"
import { validatePassword } from "@/lib/validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.")
      return
    }

    const passwordError = validatePassword(password)

    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await updatePassword(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(result.success)

      setTimeout(() => {
        router.push("/login")
        router.refresh()
      }, 800)
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Criar nova senha</CardTitle>
        <CardDescription>
          Informe e confirme a nova senha que será usada para acessar sua conta.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>

            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />

              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className="pl-9"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Digite novamente a senha"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
