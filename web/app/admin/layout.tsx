import { KeckleonProvider } from "@/providers/keckleon-provider"
import { getDictionary } from "@/lib/get-dictionary"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Como o Admin é uma área técnica, usamos o nicho padrão "generico"
  const niche = 'generico'
  const dict = getDictionary(niche)

  return (
    <KeckleonProvider dictionary={dict} niche={niche}>
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </KeckleonProvider>
  )
}