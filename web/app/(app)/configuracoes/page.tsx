import { createClient } from "@/utils/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { updateSettings } from "@/app/actions/update-settings"
import { User, Building, CreditCard } from "lucide-react"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const supabase = await createClient()

  // 1. Buscar usuário
  const { data: { user } } = await supabase.auth.getUser()

  // CORREÇÃO: Se não tiver usuário, manda pro login
  if (!user) {
    return redirect("/login")
  }
  
  // 2. Buscar perfil e tenant (Agora seguro usar user.id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tenants(*)')
    .eq('id', user.id) 
    .single()

  // Helper para exibir toast no server action
  async function saveAction(formData: FormData) {
    'use server'
    await updateSettings(formData)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Configurações</h1>
        <p className="text-zinc-400">Gerencie sua conta e dados da clínica.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Cartão da Clínica */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-500" />
              Dados da Clínica
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Informações visíveis para seus pacientes.
            </CardDescription>
          </CardHeader>
          <form action={saveAction}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName">Nome Fantasia</Label>
                {/* @ts-ignore */}
                <Input 
                  name="clinicName" 
                  /* @ts-ignore */
                  defaultValue={profile?.tenants?.name} 
                  className="bg-zinc-950 border-zinc-800 focus:ring-blue-600" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-500">ID do Sistema (Slug)</Label>
                <Input 
                  disabled 
                  /* @ts-ignore */
                  value={profile?.tenants?.slug} 
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-500 cursor-not-allowed" 
                />
              </div>
            </CardContent>
            <CardFooter className="border-t border-zinc-800 pt-6">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Salvar Alterações
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Cartão do Perfil Pessoal */}
        <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-500" />
              Seu Perfil
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Dados de acesso pessoal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email de Acesso</Label>
              <Input 
                disabled 
                value={user.email} 
                className="bg-zinc-950/50 border-zinc-800 text-zinc-500" 
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <div className="flex items-center gap-2">
                 <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded text-sm border border-emerald-500/20">
                   Administrador
                 </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cartão de Assinatura */}
        <Card className="md:col-span-2 bg-zinc-900 border-zinc-800 text-zinc-100 opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-400">
              <CreditCard className="h-5 w-5" />
              Plano e Faturamento
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Gerenciamento de assinatura (Em breve).
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="bg-zinc-950 p-4 rounded border border-zinc-800 text-sm text-zinc-400">
                Seu plano <strong>Trial Gratuito</strong> está ativo. Aproveite todas as funcionalidades.
             </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}