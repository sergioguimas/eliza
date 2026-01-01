import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '../configuracoes/settings-form'

export default async function SetupPage() {
  const supabase = await createClient()
  
  // 1. Busca o usuário para garantir que está logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o perfil para passar ao formulário
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (*)
    `)
    .eq('id', user.id)
    .single() as any

  // 3. Se o usuário já tiver organização, pula o setup
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
      
      {/* CORREÇÃO: Passando o profile obrigatório */}
      <SettingsForm profile={profile} />
    </div>
  )
}