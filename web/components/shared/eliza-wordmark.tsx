import { cn } from "@/lib/utils"

export function ElizaWordmark({
  className,
  withDot = false,
}: {
  className?: string
  withDot?: boolean
}) {
  return (
    <span
      className={cn(
        "font-semibold uppercase tracking-[0.34em] text-foreground select-none",
        className
      )}
    >
      Eliza
      {withDot && <span className="text-[#7D2430] dark:text-[#C05360]">.</span>}
    </span>
  )
}
