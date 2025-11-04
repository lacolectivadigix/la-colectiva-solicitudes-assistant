import { getGeminiModel, isGeminiConfigured } from './gemini'

export type NLUResult = {
  intent:
    | 'affirm'
    | 'decline'
    | 'interrupt'
    | 'smalltalk'
    | 'client_query'
    | 'service_query'
    | 'ack_questions'
    | 'other'
  sentiment: 'positive' | 'negative' | 'neutral'
  formality: 'formal' | 'neutral' | 'informal'
  slang_hint?: 'paisa' | 'none'
  confidence?: number
}

/**
 * Lightweight NLU via Gemini. Falls back to heuristics if the model is not configured
 * or if any error occurs. This function returns a simple classification to guide UX.
 */
export async function classifyText(text: string): Promise<NLUResult | null> {
  const t = (text || '').trim()
  if (!t) return null
  if (!isGeminiConfigured()) return null
  try {
    const model = getGeminiModel({ model: 'gemini-2.5-flash', systemInstruction: `Eres un asistente de NLU. Tarea: clasificar una frase breve del usuario.
Responde SOLO en JSON con estas claves:
{
  "intent": "affirm|decline|interrupt|smalltalk|client_query|service_query|ack_questions|other",
  "sentiment": "positive|negative|neutral",
  "formality": "formal|neutral|informal",
  "slang_hint": "paisa|none",
  "confidence": 0.0
}
Reglas:
- Si el usuario confirma de forma natural ("sí claro", "de una", emojis 👍👌), usa intent="affirm".
- Si cancela o rechaza ("no", "ahorita no"), intent="decline".
- Si interrumpe ("espera", "tengo una duda", "otra cosa"), intent="interrupt".
- Si es saludo/charla corta (hola, qué más, gracias, ¿cómo vas?), intent="smalltalk".
- Si indica empezar preguntas del brief ("ok", "dale", etc.), intent="ack_questions".
- Si pregunta o responde sobre cliente o servicio, usa client_query o service_query.
- slang_hint="paisa" cuando detectes jerga paisa.
` })

    const prompt = `Texto: "${t}"
Clasifica el texto.`
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const textOut = result.response.text()
    const cleaned = textOut.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned)
    // Validación mínima
    if (!parsed || typeof parsed !== 'object' || !parsed.intent) return null
    return parsed as NLUResult
  } catch (err) {
    // Fallback silencioso: si falla, devolvemos null para que el caller use heurísticas
    return null
  }
}