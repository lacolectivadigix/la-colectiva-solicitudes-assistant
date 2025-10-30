'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function isValidEmail(email: string): boolean {
  return /^(?=.{5,255}$)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!isValidEmail(email)) {
      setError('Formato de correo inválido')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        setError('No se pudo enviar el correo de recuperación')
        return
      }
      setMessage('Te hemos enviado un correo para restablecer tu contraseña')
    } catch (err) {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Recuperar contraseña</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Ingresa tu email para recibir el enlace</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" name="email" type="email" required className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4"><div className="text-sm text-red-700">{error}</div></div>
          )}
          {message && (
            <div className="rounded-md bg-green-50 p-4"><div className="text-sm text-green-700">{message}</div></div>
          )}

          <div>
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <Link href="/login" className="hover:underline">Volver al login</Link>
          </div>
        </form>
      </div>
    </div>
  )
}