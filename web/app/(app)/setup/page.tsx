import { SettingsForm } from "@/app/(app)/configuracoes/settings-form"

export default function SetupPage() {
  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-bold mb-6">Configure sua Empresa</h1>
      <p className="text-gray-600 mb-8">
        Para começar a usar o sistema, precisamos cadastrar sua organização.
      </p>
      <SettingsForm />
    </div>
  )
}