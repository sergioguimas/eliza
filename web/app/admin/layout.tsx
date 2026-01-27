import { KeckleonProvider } from "@/providers/keckleon-provider"
import { getDictionary } from "@/lib/get-dictionary"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Define o nicho padrão para o admin
  const niche = 'generico'
  const dict = getDictionary(niche)
  const themeClass = `theme-${niche}`

  return (
    <KeckleonProvider dictionary={dict} niche={niche}>
      <div className={`${themeClass} min-h-screen bg-background text-foreground`}>
        {children}
      </div>
    </KeckleonProvider>
  )
}