import { createBrowserClient } from '@supabase/ssr'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

let singleton: ReturnType<typeof createBrowserClient> | null = null
let initialized = false

function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  const maxAge = typeof maxAgeSeconds === 'number' ? `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}` : ''
  const sameSite = '; SameSite=Lax'
  const path = '; Path=/'
  // En localhost no forzamos Secure para asegurar envío por http
  const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  const secure = isHttps ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}${path}${sameSite}${secure}${maxAge}`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function createClient() {
  if (!singleton) {
    singleton = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!initialized && singleton) {
    initialized = true

    // Sincroniza cookies con el estado de autenticación para que el middleware pueda validar
    singleton.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      try {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const access = session?.access_token
          const refresh = session?.refresh_token
          const expiresIn = session?.expires_in // en segundos
          if (access) setCookie('sb-access-token', access, expiresIn)
          if (refresh) setCookie('sb-refresh-token', refresh, 60 * 60 * 24 * 7) // 7 días por seguridad
        } else if (event === 'SIGNED_OUT') {
          clearCookie('sb-access-token')
          clearCookie('sb-refresh-token')
        }
      } catch (err) {
        // Evitamos romper la app por errores de cookie
        console.warn('Auth cookie sync error:', err)
      }
    })

    // Al cargar, si ya hay sesión, asegura cookies iniciales
    singleton.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const s = data.session
      if (s?.access_token) setCookie('sb-access-token', s.access_token, s.expires_in)
      if (s?.refresh_token) setCookie('sb-refresh-token', s.refresh_token, 60 * 60 * 24 * 7)
    }).catch(() => {})
  }

  return singleton!
}