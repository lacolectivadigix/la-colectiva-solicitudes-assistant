'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {

      const supabase = createClient()
      try {
        await supabase.auth.signOut()
      } catch (err: any) {
        const msg = String(err?.message || '')
        const name = String(err?.name || '')
        const aborted = name === 'AbortError' || /aborted|AbortError|Failed to fetch|ERR_ABORTED/i.test(msg)
        if (!aborted) setError(msg || 'No se pudo cerrar sesión')
      }
      router.replace('/login')
    }
    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h2 className="mt-6 text-2xl font-bold text-gray-900">Cerrando sesión…</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}