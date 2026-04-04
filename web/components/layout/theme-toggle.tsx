'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { useKeckleon } from '@/providers/keckleon-provider'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { dict } = useKeckleon()

  const ui = dict.ui || {}
  const messages = dict.messages || {}

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const labelAlterarTema = ui.theme_toggle || 'Alterar tema'
  const labelClaro = ui.theme_light || 'Claro'
  const labelEscuro = ui.theme_dark || 'Escuro'
  const labelSistema = ui.theme_system || 'Sistema'
  const labelTemaAtual = messages.current_theme || 'Tema atual'

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        aria-label={labelAlterarTema}
      >
        <Monitor className="h-4 w-4" />
      </Button>
    )
  }

  const CurrentIcon =
    theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  const currentThemeLabel =
    theme === 'system'
      ? `${labelSistema} (${resolvedTheme === 'dark' ? labelEscuro : labelClaro})`
      : theme === 'dark'
      ? labelEscuro
      : labelClaro

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl border-border/70 bg-background/80 backdrop-blur-sm hover:bg-accent"
          aria-label={labelAlterarTema}
          title={`${labelTemaAtual}: ${currentThemeLabel}`}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="cursor-pointer"
        >
          <Sun className="mr-2 h-4 w-4" />
          {labelClaro}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="cursor-pointer"
        >
          <Moon className="mr-2 h-4 w-4" />
          {labelEscuro}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="cursor-pointer"
        >
          <Monitor className="mr-2 h-4 w-4" />
          {labelSistema}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}