import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '../configuracoes/settings-form'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Buscamos o perfil para passar ao formulário
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (*)
    `)
    .eq('id', user.id)
    .single() as any

  // Se o usuário já tiver uma organização vinculada, pula o setup
  if (profile?.organizations_id) {
    redirect('/dashboard')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-100">Configuração Inicial</h1>
        <p className="text-zinc-400">
          Bem-vindo! Para começar, precisamos cadastrar as informações básicas da sua clínica ou consultório.
        </p>
      </div>
      
      {/* Agora passamos o profile como prop obrigatória */}
      <SettingsForm profile={profile} />
    </div>
  )
}