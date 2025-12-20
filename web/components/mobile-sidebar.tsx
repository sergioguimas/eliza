'use client'

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

export function MobileSidebar({ clinicName }: { clinicName: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-zinc-400">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="p-0 bg-zinc-950 border-zinc-800 w-72 text-zinc-100">
        <VisuallyHidden>
          <SheetTitle>Menu de Navegação</SheetTitle>
        </VisuallyHidden>

        <AppSidebar clinicName={clinicName} />
      </SheetContent>
    </Sheet>
  )
}