import { getGeminiModel, isGeminiConfigured } from './gemini'
import type { Content, FunctionCall } from '@google/generative-ai'
import { getHerramientasDisponibles, ejecutarHerramienta } from './herramientas'
import fs from 'node:fs'
import path from 'node:path'

// Estados simplificados gestionados por el orquestador
export type ChatStep = 'INICIAL' | 'RECOLECTANDO_INFORMACION' | 'FINALIZANDO' | 'ERROR'

// Salida del orquestador hacia el route
export type OrchestratorOutput = {
  new_step: ChatStep
  assistant_message: string
  new_chat_history: Content[]
}

function buildSystemPrompt(displayName?: string): string {
  const name = displayName || 'Karol'
  return `Eres "La Colectiva", el asistente de compras corporativas de Digix.
Tu único objetivo es completar solicitudes de cotización para el usuario (${name}).
Hablas con acento paisa auténtico y reconocible (natural y sutil), con un tono conversacional de colega de Digix: amigable y cercano, pero siempre profesional y cálido. Usa expresiones paisas solo cuando aporten cercanía (por ejemplo, "¿qué más pues?", "listo"), priorizando la claridad y el respeto.

TU PROCESO:
1.  Saluda al usuario y entiende qué necesita (intención de cotizar).
2.  Usa tus herramientas (buscarCliente, buscarServicio) para validar la información inicial. Si hay múltiples clientes (ej: "MSD"), lista las opciones para que el usuario elija.
3.  Usa tu herramienta (obtenerPreguntasDelBrief) para obtener la lista EXACTA de preguntas que debes hacer.
4.  Haz las preguntas una por una, de forma natural, hasta que tengas todas las respuestas.
5.  NUNCA inventes información. Si te falta un dato (ej: 'papel', 'medidas'), DEBES preguntárselo al usuario.
6.  Cuando tengas TODAS las respuestas del brief (incluyendo link de diseño y observaciones si el usuario las da), llama a 'guardarSolicitudEnSupabase'.
7.  Informa al usuario el resultado (ej: el ID del ticket) y despídete.
8.  Si el usuario se desvía (smalltalk), responde amablemente y regresa a la tarea.
`
}

export async function orchestrateTurn(params: {
  user_text: string
  current_step: ChatStep
  display_name?: string
  chat_history: Content[]
}): Promise<OrchestratorOutput | null> {
  const t = (params.user_text || '').trim()
  if (!t || !isGeminiConfigured()) return null

  const model = getGeminiModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(params.display_name),
  } as any)

  // Registrar herramientas de función para habilitar functionCalls()
  const chat = (model as any).startChat({
    history: params.chat_history,
    tools: [
      {
        functionDeclarations: getHerramientasDisponibles(),
      },
    ],
  })

  const result = await chat.sendMessage(params.user_text)
  let response = result.response

  let functionCall: FunctionCall | undefined = response.functionCalls()?.[0]
  let finalStep: ChatStep = params.current_step === 'INICIAL' ? 'RECOLECTANDO_INFORMACION' : params.current_step

  let iterations = 0
  while (functionCall && iterations < 5) {
    iterations++
    try {
      const dir = path.join(process.cwd(), 'logs')
      const file = path.join(dir, 'ai-tools.log')
      fs.mkdirSync(dir, { recursive: true })
      const line = `[${new Date().toISOString()}] functionCall name=${functionCall.name} args=${JSON.stringify(functionCall.args)}\n`
      fs.appendFileSync(file, line, 'utf8')
    } catch {}
    const { toolResult, toolStep } = await ejecutarHerramienta(functionCall)
    if (toolStep) finalStep = toolStep

    const result2 = await chat.sendMessage([
      { functionResponse: { name: functionCall.name, response: toolResult } },
    ])
    response = result2.response
    functionCall = response.functionCalls()?.[0]
  }

  const finalHistory = await chat.getHistory()
  const finalMessage = response.text()
  try {
    const dir = path.join(process.cwd(), 'logs')
    const file = path.join(dir, 'ai-tools.log')
    fs.mkdirSync(dir, { recursive: true })
    const line = `[${new Date().toISOString()}] assistant_message=${JSON.stringify(finalMessage)}\n`
    fs.appendFileSync(file, line, 'utf8')
  } catch {}

  return {
    new_step: finalStep,
    assistant_message: finalMessage,
    new_chat_history: finalHistory,
  }
}