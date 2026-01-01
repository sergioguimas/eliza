import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  // 1. Verifica se está logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o perfil e a organização vinculada
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      organizations:organizations_id (*)
    `)
    .eq('id', user.id)
    .single() as any

  return (
    <div className="p-8 space-y-8 bg-black min-h-screen text-zinc-100">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-zinc-400 text-sm">
          Gerencie as informações da sua clínica e sua conta profissional.
        </p>
      </div>

      <div className="max-w-2xl">
        {/* Passamos o profile para o formulário carregar os dados existentes */}
        <SettingsForm profile={profile} />
      </div>
    </div>
  )
}