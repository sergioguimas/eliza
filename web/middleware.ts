import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set({ name, value, ...options }))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 1. DEFINIÇÃO DAS VARIÁVEIS DE ROTA
  const pathname = request.nextUrl.pathname
  const isSetupPage = pathname === '/setup'
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/'
  const isPublicFile = pathname.includes('.') // Ignora imagens, favicons, etc.

  if (isPublicFile) return response

  // 2. VERIFICAÇÃO DE ORGANIZAÇÃO
  let hasOrganization = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('organizations_id')
      .eq('id', user.id)
      .single()

    hasOrganization = !!profile?.organizations_id
  }

  // 3. REGRAS DE REDIRECIONAMENTO
  
  // Se não está logado e tenta acessar área restrita
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Se está logado, mas não tem empresa e não está na página de setup
  if (user && !hasOrganization && !isSetupPage) {
    //return NextResponse.redirect(new URL('/setup', request.url))
  }

  // Se já está tudo OK e tenta voltar para login ou setup
  if (user && hasOrganization && (isAuthPage || isSetupPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}