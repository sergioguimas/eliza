'use client'

import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "next-themes"

export function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme()

  return <Toaster richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
}