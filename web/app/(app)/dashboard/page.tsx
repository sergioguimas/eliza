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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {profile?.full_name || user.user_metadata?.full_name || user.email}        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card da Organização */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sua Organização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.organizations?.name || 'Sem Empresa'}</div>
            <p className="text-xs text-muted-foreground">
              Slug: {profile?.organizations?.slug}
            </p>
          </CardContent>
        </Card>

        {/* Card do Cargo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Seu Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{profile?.role}</div>
            <p className="text-xs text-muted-foreground">
              Acesso total ao sistema
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}