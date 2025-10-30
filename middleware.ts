import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rutas API sensibles protegidas por CSRF
const CSRF_PROTECTED = ['/api/auth/register', '/api/profile']

function shouldCheckCsrf(req: NextRequest) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return false
  const { pathname } = req.nextUrl
  return CSRF_PROTECTED.some((p) => pathname.startsWith(p))
}

function getCookie(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value
}

function ensureCsrfCookie(req: NextRequest, res: NextResponse) {
  const existing = getCookie(req, 'csrf_token')
  if (!existing) {
    const token = crypto.randomUUID()
    res.cookies.set('csrf_token', token, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24,
    })
  }
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const url = new URL(req.url)

  // CSRF
  ensureCsrfCookie(req, res)
  if (shouldCheckCsrf(req)) {
    const header = req.headers.get('x-csrf-token')
    const cookie = getCookie(req, 'csrf_token')
    const origin = req.headers.get('origin')
    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL
    const originOk = !allowedOrigin || !origin ? true : origin === allowedOrigin

    if (!cookie || !header || header !== cookie || !originOk) {
      return new NextResponse(JSON.stringify({ error: 'CSRF validation failed' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  // Protección de rutas
  const protectedPaths = ['/app', '/dashboard', '/api/protected']
  const isProtected = protectedPaths.some((p) => url.pathname.startsWith(p))
  if (!isProtected) return res

  const accessTokenFromCookie = req.cookies.get('sb-access-token')?.value
  const accessTokenFromHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const accessToken = accessTokenFromCookie || accessTokenFromHeader

  if (!accessToken) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data?.user) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  const status = (data.user.app_metadata as any)?.status || (data.user.user_metadata as any)?.status
  if (status && String(status).toLowerCase() !== 'activo') {
    if (url.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden: user not active' }, { status: 403 })
    }
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('inactive', '1')
    redirectUrl.searchParams.set('redirectedFrom', url.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/app/:path*',
    '/dashboard/:path*',
    '/api/:path*',
  ],
}