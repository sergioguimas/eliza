import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { TenantForm } from "@/components/tenant-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function NewTenantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const godEmail = process.env.GOD_EMAIL

  if (!godEmail || !user || user.email !== godEmail) {
    return redirect('/dashboard')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Botão de Voltar */}
      <div>
        <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary">
          <Link href="/admin" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Dashboard Admin
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Criar Nova Organização ⚡</h1>
        <p className="text-muted-foreground">
          Use este formulário para criar manualmente uma nova clínica/empresa no sistema.
        </p>
      </div>

      {/* Container do Formulário */}
      <div className="border rounded-lg bg-card p-6 shadow-sm">
        <TenantForm />
      </div>
    </div>
  )
}