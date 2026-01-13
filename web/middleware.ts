import { createServerClient } from '@supabase/ssr'
import error from 'next/error'
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
  const pathname = request.nextUrl.pathname
  
  // Ignora rotas estáticas e API
  if (pathname.includes('.') || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return response
  }

  const isAuthPage = pathname === '/login'
  const isSetupPage = pathname === '/setup'
  const isPublicRoute = pathname === '/'
  const isInviteRoute = pathname.startsWith('/convite') 

  if (!user) {
    // Se não está logado e tenta acessar área privada
    if (!isAuthPage && !isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      // Avisa para onde voltar depois do login
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  } else {
    // === LÓGICA DE ONBOARDING ===
    let isOnboardingCompleted = false
    let hasOrganization = false
    let isSuspended = false
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          organization_id, 
          organizations (
            onboarding_completed,
            status 
          )
        `)
        .eq('id', user.id)
        .single()
      
      // TRUQUE: Normaliza o dado antes de usar
      // Se vier como Array [{status...}], pega o primeiro item. Se vier Objeto, usa ele mesmo.
      const orgRaw = profile?.organizations as any
      const orgData = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw

      // === LOGS DE DEBUG (Agora usando a variável normalizada) ===
      console.log("Middleware Check:")
      console.log("Profile Error:", error)
      console.log("Status Lido:", orgData?.status) 
      // =====================
      
      if (profile?.organization_id) {
        hasOrganization = true
        isOnboardingCompleted = !!orgData?.onboarding_completed
        isSuspended = orgData?.status === 'suspended'
      }

    } catch (error) {
      console.error("Middleware Error:", error)
    }

    // === KILL SWITCH ===
    // Se a empresa está suspensa, manda para a página de bloqueio imediatamente
    if (isSuspended && !pathname.startsWith('/suspended')) {
      return NextResponse.redirect(new URL('/suspended', request.url))
    }

    // Fluxo normal de Onboarding
    if (!hasOrganization && !isSetupPage && !isPublicRoute && !isInviteRoute && !isSuspended) {
       return NextResponse.redirect(new URL('/setup', request.url))
    }

    if (hasOrganization && !isOnboardingCompleted && !isSetupPage && !isSuspended) {
       return NextResponse.redirect(new URL('/setup', request.url))
    }

    if (isOnboardingCompleted && (isAuthPage || isSetupPage)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}