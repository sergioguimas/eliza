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

  // Verifica usuário
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  
  // Ignora rotas estáticas, API e arquivos
  if (pathname.includes('.') || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return response
  }

  const isAuthPage = pathname === '/login'
  const isSetupPage = pathname === '/setup'
  const isPublicRoute = pathname === '/'
  const isInviteRoute = pathname.startsWith('/convite') 

  // === CENÁRIO 1: USUÁRIO NÃO LOGADO ===
  if (!user) {
    // Se tenta acessar página privada, manda pro login
    if (!isAuthPage && !isPublicRoute && !isInviteRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    // Se está na auth page ou pública, deixa passar
    return response
  }

  // === CENÁRIO 2: USUÁRIO LOGADO ===
  
  // Busca dados vitais do perfil
  let hasOrganization = false
  let isSuspended = false
    
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select(`
        organization_id, 
        organizations (
          subscription_status 
        )
      `)
      .eq('id', user.id)
      .single()
    
    // Verificações de segurança
    if (profile?.organization_id) {
      hasOrganization = true
      
      // Checa status da assinatura (mapeando array ou objeto único)
      const orgRaw = profile.organizations as any
      const orgData = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw
      isSuspended = orgData?.subscription_status === 'suspended'
    }

  } catch (error) {
    console.error("Middleware Error:", error)
  }

  // 1. Bloqueio por Pagamento (Kill Switch)
  if (isSuspended && !pathname.startsWith('/suspended')) {
    return NextResponse.redirect(new URL('/suspended', request.url))
  }

  // 2. Redirecionamento de Setup
  // Se NÃO tem organização e tenta acessar o painel -> Vai pro Setup
  if (!hasOrganization && !isSetupPage && !isPublicRoute && !isInviteRoute && !isSuspended) {
     return NextResponse.redirect(new URL('/setup', request.url))
  }

  // Se JÁ TEM organização e tenta acessar o Setup ou Login -> Vai pro Dashboard
  if (hasOrganization && (isSetupPage || isAuthPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}