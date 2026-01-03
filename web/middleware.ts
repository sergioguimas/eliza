import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Passa direto, sem conectar no banco, sem travas.
  return NextResponse.next()
}

export const config = {
  // Filtra para rodar apenas nas rotas principais, ignorando arquivos estáticos
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}