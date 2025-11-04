'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ id: string; content: string; role: 'user' | 'assistant'; timestamp: Date }>>([])
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [summary, setSummary] = useState<any>(null)
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

  // Saludo automático desactivado: el asistente responde sólo cuando el usuario escribe


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

    // Eliminamos el bypass de saludo genérico: siempre pasamos por la API

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

  // Utilidades para extraer el resumen desde el historial
  function extractSummaryData(allMessages: Array<{ id: string; content: string; role: 'user' | 'assistant'; timestamp: Date }>) {
    const textFromUser = allMessages.filter(m => m.role === 'user').map(m => m.content)
    const joined = textFromUser.join('\n')

    const find = (regex: RegExp) => {
      const m = joined.match(regex)
      return m ? (m[0] || '').trim() : ''
    }

    const cliente = (() => {
      // Ejemplos: "MSD COLOMBIA - ONCO", "MSD", etc.
      const m = joined.match(/\bMSD(?:\s+COLOMBIA)?(?:\s*-\s*ONCO)?\b/i)
      return m ? m[0] : ''
    })()

    const proyecto = (() => {
      const m = joined.match(/\b[Ll]anzamiento[^\n]*/)
      return m ? m[0] : ''
    })()

    const fechaEntrega = find(/\b\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñü]+\b/)
    const lugarEntrega = (() => {
      const m = joined.match(/\b[A-Za-zÁÉÍÓÚáéíóúñü]+,\s*[A-Za-zÁÉÍÓÚáéíóúñü]+\b/)
      return m ? m[0] : ''
    })()
    const direccionEntrega = (() => {
      const m = joined.match(/\b(Calle|Carrera|Avenida|Transversal|Diagonal)\b[^\n]*/i)
      return m ? m[0] : ''
    })()

    const productoCantidad = (() => {
      const m = joined.match(/\b(\d{1,6})\b[^\n]*\b(flyers?|folletos?|dipticos?|tripticos?|roll-?up|lona|vinilo)\b/i)
      return m ? `${m[1]} ${m[2] ? m[2] : ''}`.trim() : ''
    })()

    const medidas = (() => {
      const mA = joined.match(/\bA\d\b/)
      const mDim = joined.match(/\b(\d{2,4})\s*x\s*(\d{2,4})\s*(mm|cm)\b/i)
      return mA ? mA[0] : (mDim ? `${mDim[1]} x ${mDim[2]} ${mDim[3]}` : '')
    })()

    const papelGramaje = (() => {
      const m = joined.match(/\b(Couche|Bond|Opalina|Cartulina)\b[^\n]*?(\d{2,3})\s*gr/i)
      return m ? `${m[1]} ${m[2]}gr` : ''
    })()

    const impresionCaras = (() => {
      const m = joined.match(/\b(\d\/\d)\b[^\n]*?(full\s*color|ambas\s*caras)/i)
      return m ? `${m[1]} ${m[2] ? m[2] : ''}`.trim() : ''
    })()

    const acabado = (() => {
      const plegado = joined.match(/plegado[^\n]*/i)
      const laminado = joined.match(/laminado[^\n]*/i)
      const parts = [] as string[]
      if (plegado) parts.push(plegado[0])
      if (laminado) parts.push(laminado[0])
      return parts.join(' · ')
    })()

    const condiciones = (() => {
      const m = joined.match(/(condicion|condición|observaci[oó]n|nota)[^\n]*/i)
      return m ? m[0] : ''
    })()

    const contacto = {
      nombre: (user?.user_metadata?.full_name || '').toString(),
      email: (user?.email || '').toString()
    }

    const productos = [
      {
        descripcion: productoCantidad,
        medidas,
        papelGramaje,
        impresionCaras,
        acabado,
      }
    ].filter(p => p.descripcion || p.medidas || p.papelGramaje || p.impresionCaras || p.acabado)

    return {
      cliente,
      proyecto,
      fechaEntrega,
      lugarEntrega,
      direccionEntrega,
      productos,
      condiciones,
      contacto,
    }
  }

  // Vigilar mensajes para detectar ticket y construir el resumen
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const content = lastAssistant?.content || ''
    const ticketMatch = content.match(/\bS-\d+\b/i)
    if (ticketMatch) {
      const id = ticketMatch[0]
      if (id !== ticketId) {
        setTicketId(id)
        const data = extractSummaryData(messages)
        setSummary(data)
      }
    }
  }, [messages])




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

            {ticketId && summary && (
              <div className="mt-6 sm:mt-8">
                <div className="border border-[var(--brand-border)] bg-[var(--brand-surface)] rounded-xl shadow-sm">
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--brand-border)]">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Ticket</div>
                      <div className="text-lg sm:text-xl font-bold text-[var(--brand-text)]">{ticketId}</div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(ticketId || '')}
                      className="px-3 py-1.5 text-xs font-medium text-[var(--brand-on-primary)] bg-[var(--brand-primary)] rounded-md hover:bg-[var(--brand-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                      title="Copiar número de ticket"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-6 py-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Cliente</div>
                        <div className="text-sm sm:text-base font-medium text-[var(--brand-text)]">{summary.cliente || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Proyecto</div>
                        <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.proyecto || '—'}</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Fecha de entrega</div>
                          <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.fechaEntrega || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Ciudad y país</div>
                          <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.lugarEntrega || '—'}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Dirección de entrega</div>
                          <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.direccionEntrega || '—'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Contacto</div>
                      <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.contacto?.nombre || '—'}</div>
                      <div className="text-sm sm:text-base text-[var(--brand-text)]">{summary.contacto?.email || '—'}</div>
                      {summary.condiciones && (
                        <div className="mt-2">
                          <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">Condiciones especiales</div>
                          <div className="text-sm sm:text-base text-[var(--brand-text)] whitespace-pre-line">{summary.condiciones}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 sm:px-6 py-4 border-t border-[var(--brand-border)]">
                    <div className="text-xs uppercase tracking-wide text-[var(--brand-text-muted)] mb-2">Productos / Servicios</div>
                    {summary.productos?.length ? (
                      <div className="space-y-2">
                        {summary.productos.map((p: any, idx: number) => (
                          <div key={idx} className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-sm sm:text-base font-medium text-gray-900">{p.descripcion || '—'}</div>
                            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] sm:text-sm text-gray-700">
                              <div><span className="text-gray-500">Medidas:</span> {p.medidas || '—'}</div>
                              <div><span className="text-gray-500">Papel y gramaje:</span> {p.papelGramaje || '—'}</div>
                              <div><span className="text-gray-500">Impresión y caras:</span> {p.impresionCaras || '—'}</div>
                              <div><span className="text-gray-500">Acabado:</span> {p.acabado || '—'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600">Sin detalles de producto detectados.</div>
                    )}
                  </div>
                </div>
              </div>
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
