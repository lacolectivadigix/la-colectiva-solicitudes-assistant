'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RequireAuthProps {
  children: React.ReactNode
  redirectTo?: string
  allowedRoles?: string[]
}

export default function RequireAuth({ children, redirectTo = '/login', allowedRoles }: RequireAuthProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = async () => {

      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!session) {
        router.replace(redirectTo)
        return
      }

      // Validación de roles opcional
      if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const { data: userData } = await supabase.auth.getUser()
        const role: string | undefined = (userData.user?.user_metadata as any)?.role || (userData.user as any)?.role
        const norm = (s: string) => String(s || '').toLowerCase()
        const hasRole = role ? allowedRoles.map(norm).includes(norm(role)) : false
        if (!hasRole) {
          router.replace(redirectTo)
          return
        }
      }
      setReady(true)
    }
    run()
  }, [router, redirectTo, allowedRoles])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Verificando sesión y permisos…</div>
      </div>
    )
  }

  return <>{children}</>
}