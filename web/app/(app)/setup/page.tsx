import { SetupForm } from "./setup-form"

export default function SetupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 dark:bg-gray-950 p-4">
      {/* Background Decorativo (opcional) */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />
      
      <div className="w-full relative z-10">
        <SetupForm />
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 Eliza Systems. Configuração segura e criptografada.
        </p>
      </div>
    </div>
  )
}