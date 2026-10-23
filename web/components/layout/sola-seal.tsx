import Image from "next/image"

/**
 * Selo da casa (brand/BRANDING.md §9) com a assinatura da marca, "Soli Deo Gloria" (§2.1):
 * sempre em latim, sem tradução, abaixo do nome. `align` posiciona o conjunto no seu contêiner.
 */
export function SolaSeal({
  className,
  align = "center",
}: {
  className?: string
  align?: "center" | "end"
}) {
  return (
    <a
      href="https://solasoftware.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex shrink-0 flex-col gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground transition-colors ${
        align === "end" ? "items-end" : "items-center"
      } ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1.5">
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
      </span>
      <span
        lang="la"
        className="text-[8px] font-medium uppercase tracking-[0.3em] opacity-70"
      >
        Soli Deo Gloria
      </span>
    </a>
  )
}
