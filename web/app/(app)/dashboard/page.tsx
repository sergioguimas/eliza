import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Verifica quem é o usuário
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // 2. Busca os dados do Perfil e da Organização
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (
        name,
        slug
      )
    `)
    .eq('id', user.id)
    .single() as any

  // Para garantir que o TypeScript entenda a estrutura interna:
  const org = profile?.organizations

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {profile?.full_name || user.user_metadata?.full_name || user.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card da Empresa */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm max-w-xs">
          <CardContent className="p-4 flex flex-col justify-center min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Sua Empresa
            </p>
            <div className="text-lg font-bold text-zinc-100 truncate leading-tight">
              {profile?.organizations?.name || 'Sem Empresa'}
            </div>
          </CardContent>
        </Card>

        {/* Card do Cargo */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-sm max-w-xs">
          <CardContent className="p-4 flex flex-col justify-center min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
              Seu Cargo
            </p>
            <div className="text-lg font-bold capitalize text-zinc-100 leading-tight">
              {profile?.role || 'Admin'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}