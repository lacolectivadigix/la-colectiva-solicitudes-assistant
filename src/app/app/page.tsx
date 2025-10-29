'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ id: string; content: string; role: 'user' | 'assistant'; timestamp: Date }>>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [model, setModel] = useState<string>('gemini-2.5-flash')
  const [authToken, setAuthToken] = useState<string | null>(null)
  // Logo integrado desde /public/assets/images/branding (unificado con landing)
  const LOGO_SRC = '/assets/images/branding/logo-la-colectiva.png'

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: { session } } = await supabase.auth.getSession()
        setAuthToken(session?.access_token || null)
      } else {
        router.push('/login')
      }
      setLoading(false)
    }

    getUser()
  }, [router])


  const handleLogout = async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
    } catch (err: any) {
      const msg = String(err?.message || '')
      const name = String(err?.name || '')
      const aborted = name === 'AbortError' || /aborted|AbortError|Failed to fetch|ERR_ABORTED/i.test(msg)
      if (!aborted) console.warn('Logout error:', err)
    }
    router.push('/login')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      content: message,
      role: 'user' as const,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const original = message
    setMessage('')

    // Crear mensaje del asistente e ir actualizando con streaming
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, content: '🤖 Pensando con La Colectiva… ✨', role: 'assistant', timestamp: new Date() }])

    // Si es el primer turno, el usuario es solicitante y el mensaje es un saludo,
    // respondemos con el mensaje inicial fijo y no llamamos a la IA.
    const role = user?.user_metadata?.role || user?.app_metadata?.role
    const isFirstTurn = messages.length === 0
    const normalized = original.trim().toLowerCase()
    const greeted = /^(hola|buenas|buenos dias|buenos días|hey|ola)\b/.test(normalized)
    if (isFirstTurn && role === 'solicitante' && greeted) {
      const firstReply = '¡Hola! Soy La Colectiva, tu asistente para crear solicitudes. Para comenzar, por favor dime, ¿para qué cliente es esta solicitud?'
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: firstReply } : m))
      return
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 600000)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      // Historial completo hasta antes del nuevo turno
      const historyToSend = [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))

      // Handshake de confirmación: si el último bot pidió confirmar y el usuario afirma
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      const askedConfirm = /(¿\s*es esto correcto\??)/i.test(lastAssistant?.content || '')
      const isAffirmative = /^(si|sí|correcto|confirmo|de acuerdo|acepto|ok|vale)\b/i.test(original.trim().toLowerCase())
      const confirmedFlag = askedConfirm && isAffirmative

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: original,
          model,
          history: historyToSend,
          confirmed: confirmedFlag
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        const errMsg = json?.error || `Error ${res.status}`
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${errMsg}` } : m))
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder('utf-8')
      if (!reader) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'No se pudo leer la respuesta' } : m))
        return
      }

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m))
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated.trim() || 'Procesando tu solicitud...' } : m))
    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'Tiempo de espera agotado' : (err?.message || 'Error de red')
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m))
    }
  }




  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  const displayName = user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'usuario')
  const genderRaw = (user?.user_metadata?.gender || user?.user_metadata?.genero || user?.user_metadata?.sexo || '').toString()
  const welcomeWord = /female|femenino|mujer|^f$/i.test(genderRaw)
    ? 'Bienvenida'
    : (/male|masculino|hombre|^m$/i.test(genderRaw) ? 'Bienvenido' : 'Bienvenido')

  return (
    <div className="h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-[15px] sm:px-5 py-2 sm:py-3 grid grid-cols-1 sm:grid-cols-[30%_40%_30%] items-center gap-x-4 gap-y-1 sm:gap-y-0 bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-md">
          {/* Columna izquierda (30%) */}
          <div className="leading-tight text-[var(--brand-text)]">
            <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs md:text-sm">
              <span>👋</span>
              <span>Hola <span className="font-medium">{displayName}</span>, {welcomeWord} a La Colectiva</span>
            </div>
          </div>

          {/* Columna central (40%) */}
          <div className="flex items-center justify-center">
            <Image
              src={LOGO_SRC}
              alt="Logo de La Colectiva"
              width={156}
              height={52}
            className="h-[2.64rem] sm:h-[3.12rem] w-auto"
              priority
            />
          </div>

          {/* Columna derecha (30%) */}
          <div className="flex items-center justify-center sm:justify-end gap-2">
            {user?.user_metadata?.role === 'administrador' && (
              <Link href="/admin/auth-events" className="px-3 py-1.5 text-xs font-medium text-[var(--brand-on-primary)] bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]">
                Eventos
              </Link>
            )}
            <button onClick={handleLogout} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 mr-[12px]">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <main className="pt-20 sm:pt-24 h-full">
        <div className="max-w-3xl mx-auto h-[calc(100vh-4rem)] w-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-5 sm:py-6 space-y-2 sm:space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-lg font-medium mb-2">¡Hola! Soy tu asistente de La Colectiva</div>
                <div className="text-sm">Escribe tu mensaje para comenzar una conversación</div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${msg.role === 'user' ? 'bg-blue-600 text-white rounded-xl rounded-bl-xl' : 'bg-gray-100 text-gray-900 rounded-xl rounded-br-xl border border-gray-200'} max-w-[18rem] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 shadow`}> 
                    <div className={`text-[13px] sm:text-sm whitespace-pre-line ${/Pensando/.test(msg.content) && msg.role !== 'user' ? 'animate-pulse' : ''}`}>{msg.content}</div>
                    <div className={`text-[11px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>{msg.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Cuéntame tu caso como a una persona… ✊💬"
                className="flex-1 px-4 py-2 rounded-full border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-2 rounded-full border border-gray-300 text-sm bg-white"
                title="Selecciona el modelo de IA"
              >
                <option value="gemini-2.5-flash">Rápido (2.5 Flash)</option>
                <option value="gemini-2.5-pro">Preciso (2.5 Pro)</option>
                <option value="gemini-2.0-flash">Rápido (2.0 Flash)</option>
              </select>
              <button
                type="submit"
                disabled={!message.trim()}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--brand-on-primary)] hover:bg-[var(--brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Enviar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M2.5 19.5l19-7-19-7v6.5l13 0-13 0z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
