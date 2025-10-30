'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function isValidEmail(email: string): boolean {
  return /^(?=.{5,255}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}
function isAllowedDomain(email: string): boolean {
  return email.toLowerCase().endsWith('@digix.co')
}

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (!fullName || fullName.trim().length < 3) {
      setError('Nombre inválido (min 3 caracteres)')
      return
    }
    if (!isValidEmail(email)) {
      setError('Formato de correo inválido')
      return
    }
    if (!isAllowedDomain(email)) {
      setError('Solo se permite correo @digix.co')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, '')
      // 1) Registro directo en Supabase Auth (envío de correo gestionado por Supabase)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: 'solicitante', full_name: fullName }, emailRedirectTo: `${origin}/login` },
      })
      if (error) {
        setError(error.message || 'Error registrando usuario en Supabase Auth')
        return
      }
      const authUserId = data.user?.id
      if (!authUserId) {
        setError('No se pudo obtener el ID del usuario de Auth')
        return
      }

      // Registro gestionado por Supabase Auth; mostramos mensaje y sugerimos revisar correo
      setMessage('Registro exitoso. Hemos enviado un correo de confirmación. Revisa tu bandeja y sigue el enlace para activar tu cuenta.')
    } catch (err) {
      setError('Error de red: inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setMessage('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) {
        setError(error.message || 'No se pudo reenviar el correo')
        return
      }
      setMessage('Hemos reenviado el correo de confirmación. Revisa tu bandeja.')
    } catch (err) {
      setError('Error de red al reenviar. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Crear cuenta</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Regístrate para acceder a La Colectiva</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="fullName" className="sr-only">Nombre completo</label>
              <input id="fullName" name="fullName" type="text" required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Email institucional @digix.co" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
            </div>
            <div>
              <label htmlFor="confirm" className="sr-only">Confirmar contraseña</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{message}</div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Registrando...' : 'Registrarse'}
            </button>
            <button type="button" onClick={handleResend} disabled={!email || !isValidEmail(email) || !isAllowedDomain(email)} className="group relative flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300">
              Reenviar correo
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <Link href="/login" className="hover:underline">¿Ya tienes cuenta? Inicia sesión</Link>
          </div>
        </form>
      </div>
    </div>
  )
}