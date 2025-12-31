import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Ajuste para compatibilidade com Next.js 16
          cookiesToSet.forEach(({ name, value, options }) => {
            // Atualiza o request
            request.cookies.set({ name, value, ...options })
            
            // Cria uma nova resposta para garantir que o cookie seja enviado
            response = NextResponse.next({
              request,
            })
            
            // Atualiza a resposta final com a sintaxe de objeto único
            response.cookies.set({
              name,
              value,
              ...options,
              // Correção de tipos para SameSite e Expires
              sameSite: typeof options.sameSite === 'boolean' ? undefined : options.sameSite,
              expires: options.expires instanceof Date ? options.expires.getTime() : undefined,
            })
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Lógica de proteção de rotas
  const isAuthPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup' || request.nextUrl.pathname === '/'
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/calendar') || request.nextUrl.pathname.startsWith('/dashboard')

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/calendar', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}