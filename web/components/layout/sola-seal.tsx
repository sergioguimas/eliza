import Image from "next/image"

export function SolaSeal({ className }: { className?: string }) {
  return (
    <a
      href="https://solasoftware.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}
    >
      <Image
        src="/brand/sola-software-icone-tema-claro-transparente.png"
        alt=""
        width={16}
        height={16}
        className="block dark:hidden"
      />
      <Image
        src="/brand/sola-software-icone-transparente.png"
        alt=""
        width={16}
        height={16}
        className="hidden dark:block"
      />
      SolaSoftware
    </a>
  )
}
