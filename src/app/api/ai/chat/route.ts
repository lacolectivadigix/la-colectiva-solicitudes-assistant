import { NextResponse } from 'next/server'
import { getUserFromAuthHeader } from '@/lib/supabase/server'
import { orchestrateTurn } from '@/lib/ai/prompt_orchestrator'
import type { ChatStep } from '@/lib/ai/prompt_orchestrator'
import type { Content } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

type SessionState = {
  current_step: ChatStep
  chat_history: Content[]
}

const sessionStates = new Map<string, SessionState>()

function getUserSessionKey(headers: Headers, userId?: string | null) {
  const sid = userId || headers.get('x-session-id') || headers.get('x-forwarded-for') || 'anon'
  return String(sid)
}

async function readUserText(req: Request): Promise<string> {
  try {
    const body = await req.json().catch(() => ({} as any))
    const text =
      (typeof body?.prompt === 'string' && body.prompt) ||
      (typeof body?.input === 'string' && body.input) ||
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.text === 'string' && body.text) ||
      ''
    return String(text).trim()
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  // 1) Autenticación
  const user = await getUserFromAuthHeader(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const displayName = (() => {
    const full = (user as any)?.user_metadata?.full_name || (user as any)?.user_metadata?.name
    const email = (user as any)?.email || ''
    const nick = email ? String(email).split('@')[0] : ''
    return String(full || nick || 'parcera').trim()
  })()

  // 2) Sesión: reset opcional
  const sessionKey = getUserSessionKey(req.headers, user.id)
  const wantReset = (req.headers.get('x-reset-session') || '').toLowerCase() === 'true'
  if (wantReset) {
    sessionStates.delete(sessionKey)
  }

  // 3) Inicializar sesión mínima si no existe
  if (!sessionStates.has(sessionKey)) {
    sessionStates.set(sessionKey, { current_step: 'INICIAL', chat_history: [] })
  }
  const state = sessionStates.get(sessionKey)!

  // 4) Texto del usuario
  const userText = await readUserText(req)
  if (!userText) return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })

  // 5) Delegar al orquestador
  const result = await orchestrateTurn({
    user_text: userText,
    current_step: state.current_step,
    display_name: displayName,
    chat_history: state.chat_history,
  })

  if (!result) {
    return NextResponse.json({ error: 'No se pudo procesar la solicitud' }, { status: 500 })
  }

  // 6) Actualizar sesión con el nuevo estado e historial
  sessionStates.set(sessionKey, {
    current_step: result.new_step,
    chat_history: result.new_chat_history,
  })

  // 7) Responder al cliente con el mensaje del asistente
  return new NextResponse(result.assistant_message, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    status: 200,
  })
}