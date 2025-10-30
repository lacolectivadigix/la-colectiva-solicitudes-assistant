import { NextResponse } from 'next/server'
import { isGeminiConfigured, streamTextFromPrompt } from '@/lib/ai/gemini'

// Fuerza ejecución dinámica para evitar caching de Next en este endpoint
export const dynamic = 'force-dynamic'

function getTimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_MS
  const ms = raw ? Number(raw) : 15000
  return Number.isFinite(ms) && ms > 0 ? ms : 15000
}

export async function POST(req: Request) {
  try {
    // Validar que Gemini esté configurado
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'Gemini no está configurado. Define GEMINI_API_KEY en .env.local' },
        { status: 500 },
      )
    }

    // Parseo de JSON
    let payload: any
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const prompt = String(payload?.prompt || payload?.message || '').trim()
    const model = String(payload?.model || '') || undefined

    if (!prompt) {
      return NextResponse.json({ error: 'prompt requerido' }, { status: 400 })
    }

    // Timeout defensivo para respuestas del modelo
    const timeoutMs = getTimeoutMs()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const result = await streamTextFromPrompt(prompt, { model })

    const stream = new ReadableStream<Uint8Array>({
      async start(controllerStream) {
        try {
          for await (const chunk of (result as any).stream) {
            const text: string = chunk.text()
            controllerStream.enqueue(new TextEncoder().encode(text))
          }
          controllerStream.close()
        } catch (err: any) {
          // Si aborta por timeout, enviar un mensaje claro
          const msg = controller.signal.aborted
            ? 'Tiempo de espera agotado'
            : err?.message || 'Error generando respuesta'
          controllerStream.enqueue(new TextEncoder().encode(`\n[error] ${msg}`))
          controllerStream.close()
        } finally {
          clearTimeout(timeout)
        }
      },
      cancel() {
        clearTimeout(timeout)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal error', details: err?.message || String(err) },
      { status: 500 },
    )
  }
}