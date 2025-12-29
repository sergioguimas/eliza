import { redirect } from 'next/navigation'

export default function HomePage() {
  // Redireciona qualquer acesso na raiz direto para o painel
  redirect('/dashboard')
}